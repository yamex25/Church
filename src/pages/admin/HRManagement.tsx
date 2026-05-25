import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Briefcase, 
  CreditCard, 
  Plus, 
  Search, 
  X, 
  UserPlus, 
  DollarSign,
  TrendingUp,
  Download,
  Calendar,
  Zap,
  Receipt,
  History,
  Printer,
  ChevronRight
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, recordExpense } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Employee, PayrollRecord, ExpenseType } from '@/src/types';
import { formatCurrency, cn, formatDate, downloadExcel } from '@/src/lib/utils';
import { useAuth } from '@/src/components/AuthContext';

export default function HRManagement() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showAddPayroll, setShowAddPayroll] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'departments'>('employees');
  const [searchTerm, setSearchTerm] = useState('');

  const initialEmployeeState = {
    name: '',
    role: '',
    department: 'Administration',
    email: '',
    phone: '',
    salary: 0,
    status: 'Active' as const,
    joinedDate: new Date().toISOString().split('T')[0],
    isDepartmentHead: false,
    bankDetails: '',
    tinNumber: ''
  };

  const [newEmployee, setNewEmployee] = useState(initialEmployeeState);

  const [newPayroll, setNewPayroll] = useState({
    employeeId: '',
    month: new Date().toISOString().slice(0, 7),
    status: 'Paid' as 'Paid' | 'Partial',
    paidAmount: 0,
    paymentMethod: 'Bank Transfer'
  });

  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [showAddDept, setShowAddDept] = useState(false);

  useEffect(() => {
    const qE = query(collection(db, 'employees'), orderBy('name'));
    const unsubscribeE = onSnapshot(qE, (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Employee[]);
    }, (err) => {
      console.error("Employee listener error:", err);
    });

    const qP = query(collection(db, 'payroll'), orderBy('paymentDate', 'desc'));
    const unsubscribeP = onSnapshot(qP, (snapshot) => {
      setPayroll(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PayrollRecord[]);
    }, (err) => {
      console.error("Payroll listener error:", err);
    });

    const qD = query(collection(db, 'departments'));
    const unsubscribeD = onSnapshot(qD, (snapshot) => {
      setDepartments(snapshot.docs.map(d => ({ id: d.id, name: d.data().name })));
      setLoading(false);
    }, (err) => {
      console.error("Departments listener error:", err);
      setLoading(false);
    });

    return () => {
      unsubscribeE();
      unsubscribeP();
      unsubscribeD();
    };
  }, []);

  const groupedPayroll = React.useMemo(() => {
    const groups: { [key: string]: any } = {};
    payroll.forEach(p => {
      const key = `${p.employeeId}-${p.month}`;
      if (!groups[key]) {
        groups[key] = {
          id: p.id,
          employeeId: p.employeeId,
          employeeName: p.employeeName,
          month: p.month,
          totalSalary: Number(p.totalSalary) || 0,
          paidAmount: 0,
          paymentDate: p.paymentDate,
          status: 'Partial',
          paymentMethod: p.paymentMethod
        };
      }
      groups[key].paidAmount += Number(p.paidAmount) || 0;
      if (new Date(p.paymentDate) > new Date(groups[key].paymentDate)) {
        groups[key].paymentDate = p.paymentDate;
      }
    });

    return Object.values(groups).map(g => ({
      ...g,
      balance: Math.max(0, g.totalSalary - g.paidAmount),
      status: g.totalSalary - g.paidAmount <= 0 ? 'Paid' : 'Partial'
    })).sort((a, b) => b.month.localeCompare(a.month) || a.employeeName.localeCompare(b.employeeName));
  }, [payroll]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Duplicate email check
    if (!editingEmployee) {
      const emailExists = employees.some(e => e.email === newEmployee.email);
      const phoneExists = employees.some(e => e.phone === newEmployee.phone);
      
      if (emailExists && phoneExists) {
        setError("This email and phone number are already registered to existing employees.");
        setSubmitting(false);
        return;
      } else if (emailExists) {
        setError("This email is already registered to Ian existing employee. Each email can only be used once.");
        setSubmitting(false);
        return;
      } else if (phoneExists) {
        setError("This phone number is already registered to an existing employee.");
        setSubmitting(false);
        return;
      }
    }

    try {
      if (editingEmployee) {
        const docRef = doc(db, 'employees', editingEmployee.id!);
        await updateDoc(docRef, {
          ...newEmployee,
          salary: Number(newEmployee.salary),
          updatedAt: serverTimestamp()
        });
        alert("Staff record updated successfully.");
      } else {
        await addDoc(collection(db, 'employees'), {
          ...newEmployee,
          salary: Number(newEmployee.salary),
          createdAt: serverTimestamp()
        });
        alert("Staff contract created successfully.");
      }
      setShowAddEmployee(false);
      setEditingEmployee(null);
      setNewEmployee(initialEmployeeState);
    } catch (err: any) {
      console.error("Error saving employee:", err);
      handleFirestoreError(err, editingEmployee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setNewEmployee({
      name: emp.name,
      role: emp.role,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      salary: emp.salary,
      status: emp.status,
      joinedDate: emp.joinedDate,
      isDepartmentHead: emp.isDepartmentHead,
      bankDetails: emp.bankDetails || '',
      tinNumber: emp.tinNumber || ''
    });
    setShowAddEmployee(true);
  };

  const handlePayStaff = (emp: Employee) => {
    setNewPayroll({
      ...newPayroll,
      employeeId: emp.id!,
      status: 'Paid',
      paidAmount: 0 // Will be calculated in modal
    });
    setShowAddPayroll(true);
  };

  const getMonthBalance = (empId: string, month: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 0;
    
    // Sum only previous payments for this employee in this month
    const totalPaidInMonth = payroll
      .filter(p => p.employeeId === empId && p.month === month)
      .reduce((sum, p) => sum + (Math.round(Number(p.paidAmount)) || 0), 0);
      
    return Math.max(0, Math.round(Number(emp.salary)) - totalPaidInMonth);
  };

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newPayroll.employeeId);
    if (!emp || !user) return;

    setSubmitting(true);
    setError(null);

    try {
      // Restriction: Employee cannot be paid for months before they joined
      const joinedMonth = emp.joinedDate.slice(0, 7);
      if (newPayroll.month < joinedMonth) {
        alert(`Access Denied: This staff member (${emp.name}) joined in ${joinedMonth}. You cannot process payroll for ${newPayroll.month}.`);
        setSubmitting(false);
        return;
      }

      // Calculate current outstanding balance BEFORE this transaction
      const currentBalance = getMonthBalance(emp.id!, newPayroll.month);

      if (currentBalance <= 0) {
        alert(`Access Denied: This staff member (${emp.name}) has already been FULLY PAID for ${newPayroll.month}.`);
        setSubmitting(false);
        return;
      }

      const paymentAmountValue = newPayroll.status === 'Paid' ? currentBalance : Number(newPayroll.paidAmount);
      const paymentAmount = Math.round(paymentAmountValue); // Use round to avoid -1 issues from floating point
      
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        alert("Invalid amount: Please enter a positive number for payment.");
        setSubmitting(false);
        return;
      }

      if (paymentAmount > currentBalance + 1) { // Add tiny buffer for rounding errors if any
        alert(`Validation Error: The payment amount (UGX ${paymentAmount.toLocaleString()}) exceeds the outstanding balance (UGX ${currentBalance.toLocaleString()}) for ${newPayroll.month}.`);
        setSubmitting(false);
        return;
      }

      const newBalance = Math.round(currentBalance - paymentAmount);
      const finalStatus = newBalance <= 10 ? 'Paid' : 'Partial'; // 10 UGX threshold for settling

      const payrollDocRef = await addDoc(collection(db, 'payroll'), {
        employeeId: emp.id,
        employeeName: emp.name,
        totalSalary: Math.round(Number(emp.salary)),
        paidAmount: Math.round(Number(paymentAmount)),
        balance: Math.max(0, newBalance),
        month: newPayroll.month,
        paymentDate: new Date().toISOString(),
        status: finalStatus,
        paymentMethod: newPayroll.paymentMethod,
        recordedBy: user.uid,
        createdAt: serverTimestamp()
      });

      // Record expense for payroll payment
      await recordExpense({
        type: ExpenseType.SALARY,
        category: 'Payroll',
        description: `Salary payment for ${emp.name} - ${newPayroll.month}`,
        amount: Math.round(Number(paymentAmount)),
        date: new Date().toISOString().split('T')[0],
        relatedId: payrollDocRef.id,
        recordedBy: user.uid,
      });
      console.log(`✓ Expense automatically recorded - Salary: UGX ${paymentAmount.toLocaleString()} for ${emp.name}`);

      setShowAddPayroll(false);
      setNewPayroll({
        employeeId: '',
        month: new Date().toISOString().slice(0, 7),
        status: 'Paid',
        paidAmount: 0,
        paymentMethod: 'Bank Transfer'
      });
      alert(`Payment Successful: UGX ${paymentAmount.toLocaleString()} processed for ${emp.name}. Remaining Balance: UGX ${newBalance.toLocaleString()}`);
    } catch (err: any) {
      console.error("Critical Payroll Error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkPayroll = async () => {
    const activeStaff = employees.filter(e => e.status === 'Active');
    if (activeStaff.length === 0) {
      alert("No active staff found to pay.");
      return;
    }

    const month = new Date().toISOString().slice(0, 7);
    const confirmPay = confirm(`Are you sure you want to process bulk full payroll for ${activeStaff.length} staff members for ${month}?`);
    if (!confirmPay) return;

    setSubmitting(true);
    let successCount = 0;

    try {
      for (const emp of activeStaff) {
        // Calculate remaining balance for this month using the shared helper
        const currentBalance = getMonthBalance(emp.id!, month);

        if (currentBalance <= 0) continue; // Already fully paid

        const payrollDocRef = await addDoc(collection(db, 'payroll'), {
          employeeId: emp.id,
          employeeName: emp.name,
          totalSalary: Number(emp.salary),
          paidAmount: Number(currentBalance),
          balance: 0,
          month,
          paymentDate: new Date().toISOString(),
          status: 'Paid',
          paymentMethod: 'Bank Transfer',
          recordedBy: user?.uid,
          createdAt: serverTimestamp()
        });

        // Record expense automatically for bulk payroll
        await recordExpense({
          type: ExpenseType.SALARY,
          category: 'Payroll',
          description: `Salary payment for ${emp.name} - ${month}`,
          amount: Math.round(Number(currentBalance)),
          date: new Date().toISOString().split('T')[0],
          relatedId: payrollDocRef.id,
          recordedBy: user?.uid,
        });
        successCount++;
      }
      alert(`Bulk payroll processed successfully for ${successCount} staff members.`);
    } catch (err: any) {
      console.error("Bulk payroll error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'payroll');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleBalance = (record: PayrollRecord) => {
    setNewPayroll({
      employeeId: record.employeeId,
      month: record.month,
      status: 'Paid',
      paidAmount: record.balance,
      paymentMethod: record.paymentMethod || 'Bank Transfer'
    });
    setShowAddPayroll(true);
  };

  const handlePrintPayslip = () => {
    // Create a new window for printing to avoid modal interference
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups for this site to print payslips');
      return;
    }
    
    // Get the payslip content
    const payslipContent = document.getElementById('payslip-content');
    if (!payslipContent) return;
    
    // Create the print document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${selectedPayslip.employeeName} - ${selectedPayslip.month}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              background: white;
            }
            .payslip-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              position: relative;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(45deg);
              font-size: 80px;
              font-weight: 900;
              color: #3b82f6;
              opacity: 0.03;
              pointer-events: none;
            }
            .header-bar {
              height: 16px;
              background: #3b82f6;
              margin-bottom: 20px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
            }
            .logo-section {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .logo {
              width: 32px;
              height: 32px;
              background: #3b82f6;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              border-radius: 8px;
            }
            .company-name {
              font-size: 20px;
              font-weight: 900;
              color: #000;
              letter-spacing: -0.05em;
            }
            .subtitle {
              color: #3b82f6;
              font-weight: 900;
              letter-spacing: 0.2em;
              font-size: 10px;
              text-transform: uppercase;
            }
            .payslip-title {
              text-align: right;
            }
            .payslip-title h3 {
              font-size: 32px;
              font-weight: 900;
              font-style: italic;
              letter-spacing: -0.05em;
              margin-bottom: 4px;
            }
            .payslip-title .month {
              color: #6b7280;
              font-weight: 900;
              letter-spacing: 0.3em;
              font-size: 10px;
              text-transform: uppercase;
            }
            .employee-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-bottom: 40px;
              padding-bottom: 40px;
              border-bottom: 2px dashed #e5e7eb;
            }
            .info-section {
              space-y: 20px;
            }
            .info-box {
              background: #f9fafb;
              padding: 16px;
              border-radius: 16px;
              border: 1px solid #f3f4f6;
              margin-bottom: 20px;
            }
            .info-label {
              color: #6b7280;
              font-weight: 900;
              letter-spacing: 0.1em;
              font-size: 9px;
              text-transform: uppercase;
              margin-bottom: 6px;
            }
            .employee-name {
              font-size: 20px;
              font-weight: 900;
              color: #000;
              margin-bottom: 4px;
            }
            .employee-role {
              font-weight: 700;
              font-size: 12px;
              color: #3b82f6;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .transaction-info {
              text-align: right;
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
            }
            .transaction-info > div {
              margin-bottom: 20px;
            }
            .transaction-ref {
              font-family: monospace;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: -0.05em;
              color: #9ca3af;
            }
            .salary-section {
              margin-bottom: 40px;
            }
            .salary-title {
              color: #6b7280;
              font-weight: 900;
              letter-spacing: 0.2em;
              font-size: 10px;
              text-transform: uppercase;
              margin-bottom: 16px;
            }
            .salary-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 16px 0;
              border-bottom: 1px dotted #e5e7eb;
            }
            .salary-label {
              font-weight: 700;
              font-size: 14px;
              color: #4b5563;
            }
            .salary-amount {
              font-weight: 900;
              font-size: 16px;
              color: #000;
            }
            .total-row {
              border-top: 2px solid #3b82f6;
              margin-top: 20px;
              padding-top: 20px;
            }
            .total-label {
              color: #3b82f6 !important;
              font-size: 16px !important;
            }
            .total-amount {
              color: #3b82f6 !important;
              font-size: 20px !important;
            }
            .footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; }
              .payslip-container { 
                box-shadow: none;
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <div class="watermark">OFFICIAL</div>
            <div class="header-bar"></div>
            
            <div class="header">
              <div class="logo-section">
                <div class="logo">C</div>
                <div>
                  <div class="company-name">CHURCH MANAGER</div>
                  <div class="subtitle">Official Payment Advice</div>
                </div>
              </div>
              <div class="payslip-title">
                <h3>PAYSLIP</h3>
                <div class="month">${selectedPayslip.month}</div>
              </div>
            </div>

            <div class="employee-info">
              <div class="info-section">
                <div class="info-box">
                  <div class="info-label">Employee Details</div>
                  <div class="employee-name">${selectedPayslip.employeeName}</div>
                  <div class="employee-role">${employees.find(e => e.id === selectedPayslip.employeeId)?.role || 'N/A'}</div>
                </div>
                <div>
                  <div class="info-label">Ministry Department</div>
                  <div style="font-weight: 700; font-size: 14px;">${employees.find(e => e.id === selectedPayslip.employeeId)?.department || 'N/A'}</div>
                </div>
              </div>
              <div class="transaction-info">
                <div>
                  <div class="info-label">Transaction Ref</div>
                  <div class="transaction-ref">#CM-${selectedPayslip.id?.slice(0, 8).toUpperCase()}</div>
                </div>
                <div>
                  <div class="info-label">Settlement Method</div>
                  <div style="font-weight: 700; font-size: 14px;">${selectedPayslip.paymentMethod}</div>
                </div>
                <div>
                  <div class="info-label">Identification / TIN</div>
                  <div style="font-weight: 700; font-size: 14px; letter-spacing: 0.05em;">${employees.find(e => e.id === selectedPayslip.employeeId)?.tinNumber || 'NON-FILER'}</div>
                </div>
              </div>
            </div>

            <div class="salary-section">
              <div class="salary-title">Salary Breakdown</div>
              
              <div class="salary-row">
                <div class="salary-label">Basic Monthly Earnings</div>
                <div class="salary-amount">${formatCurrency(selectedPayslip.totalSalary)}</div>
              </div>
              
              <div class="salary-row">
                <div class="salary-label">Amount Paid</div>
                <div class="salary-amount">${formatCurrency(selectedPayslip.paidAmount)}</div>
              </div>
              
              <div class="salary-row">
                <div class="salary-label">Outstanding Balance</div>
                <div class="salary-amount">${formatCurrency(selectedPayslip.balance)}</div>
              </div>
              
              <div class="salary-row total-row">
                <div class="salary-label total-label">Net Payment This Period</div>
                <div class="salary-amount total-amount">${formatCurrency(selectedPayslip.paidAmount)}</div>
              </div>
            </div>

            <div class="footer">
              <div>This is an official church payment document</div>
              <div>Generated on ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || submitting) return;
    
    // Duplicate check
    if (departments.some(d => d.name.toLowerCase() === newDeptName.trim().toLowerCase())) {
      alert(`Department "${newDeptName}" already exists.`);
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'departments'), {
        name: newDeptName.trim(),
        createdAt: serverTimestamp()
      });
      setNewDeptName('');
      setShowAddDept(false);
      alert(`Department "${newDeptName}" created successfully.`);
    } catch (err: any) {
      console.error("Error adding department:", err);
      handleFirestoreError(err, OperationType.CREATE, 'departments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitializeDepts = async () => {
    if (submitting) return;
    const defaults = ['Administration', 'Spiritual Ministry', 'Media & ICT', 'Music & Worship', 'Maintenance & Security', 'Outreach'];
    const confirmInit = confirm("This will create 6 standard ministry departments. Continue?");
    if (!confirmInit) return;

    setSubmitting(true);
    let count = 0;
    try {
      for (const d of defaults) {
        // Simple check to avoid duplicates if possible, though listener will update
        if (departments.some(dept => dept.name === d)) continue;
        
        await addDoc(collection(db, 'departments'), {
          name: d,
          createdAt: serverTimestamp()
        });
        count++;
      }
      alert(`Standard setup complete! ${count} departments initialized.`);
    } catch (err: any) {
      console.error("Error initializing departments:", err);
      handleFirestoreError(err, OperationType.CREATE, 'departments');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveDept = async (id: string, name: string) => {
    if (employees.some(e => e.department === name)) {
      alert("Cannot remove department that still has staff members. Please reassign or remove staff first.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently remove the "${name}" department?`)) return;
    
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'departments', id));
      alert("Department removed successfully.");
    } catch (err: any) {
      console.error("Error removing department:", err);
      handleFirestoreError(err, OperationType.DELETE, 'departments');
    } finally {
      setSubmitting(false);
    }
  };

  const totalMonthlyPayroll = employees.reduce((acc, curr) => acc + (curr.status === 'Active' ? Number(curr.salary) : 0), 0);
  const activeEmployeeCount = employees.filter(e => e.status === 'Active').length;
  const onLeaveCount = employees.filter(e => e.status === 'On Leave').length;
  const terminatedCount = employees.filter(e => e.status === 'Terminated').length;

  return (
    <div className="space-y-8">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #payslip-content, #payslip-content * {
              visibility: visible;
            }
            #payslip-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}
      </style>
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-church-black to-slate-600 bg-clip-text text-transparent">HR & Payroll Center</h2>
          <p className="text-church-gray text-sm font-medium">Manage church staff, contracts and monthly salary payments.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => downloadExcel(employees, 'church_employees.xlsx')}
            className="p-2 border border-church-blue/10 rounded-xl text-church-gray hover:bg-white shadow-sm transition-all"
          >
            <Download className="w-5 h-5" />
          </button>
          {activeTab === 'employees' ? (
            <button 
              onClick={() => {
                setEditingEmployee(null);
                setNewEmployee(initialEmployeeState);
                setShowAddEmployee(true);
              }}
              className="flex items-center gap-2 bg-church-blue text-white px-5 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Employee
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleBulkPayroll}
                disabled={submitting}
                className="flex items-center gap-2 bg-church-black text-white px-5 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-church-yellow" />
                Bulk Pay
              </button>
              <button 
                onClick={() => setShowAddPayroll(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all"
              >
                <DollarSign className="w-4 h-4" />
                Pay Salary
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-50 p-3 rounded-2xl">
              <Users className="w-6 h-6 text-church-blue" />
            </div>
          </div>
          <p className="text-church-gray text-[10px] font-black uppercase tracking-widest">Active Staff</p>
          <h3 className="text-3xl font-black mt-1 text-emerald-600">{activeEmployeeCount}</h3>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-amber-50 p-3 rounded-2xl">
              <Briefcase className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-church-gray text-[10px] font-black uppercase tracking-widest">On Leave</p>
          <h3 className="text-3xl font-black mt-1 text-amber-600">{onLeaveCount}</h3>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-rose-50 p-3 rounded-2xl">
              <UserPlus className="w-6 h-6 text-rose-600" />
            </div>
          </div>
          <p className="text-church-gray text-[10px] font-black uppercase tracking-widest">Terminated</p>
          <h3 className="text-3xl font-black mt-1 text-rose-600">{terminatedCount}</h3>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-church-blue/5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-50 p-3 rounded-2xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-church-gray text-[10px] font-black uppercase tracking-widest">Monthly Commitment</p>
          <h3 className="text-2xl font-black mt-1 text-church-blue">{formatCurrency(totalMonthlyPayroll)}</h3>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-[40px] border border-church-blue/5 shadow-xl overflow-hidden">
        <div className="flex border-b border-church-blue/5">
          <button 
            onClick={() => setActiveTab('employees')}
            className={cn(
              "flex-1 px-8 py-5 text-sm font-black uppercase tracking-widest transition-all relative",
              activeTab === 'employees' ? "text-church-blue bg-church-soft/30" : "text-church-gray hover:text-church-black"
            )}
          >
            Staff Directory
            {activeTab === 'employees' && <motion.div layoutId="hrTab" className="absolute bottom-0 left-0 right-0 h-1 bg-church-blue" />}
          </button>
          <button 
            onClick={() => setActiveTab('payroll')}
            className={cn(
              "flex-1 px-8 py-5 text-sm font-black uppercase tracking-widest transition-all relative",
              activeTab === 'payroll' ? "text-emerald-600 bg-church-soft/30" : "text-church-gray hover:text-church-black"
            )}
          >
            Payroll History
            {activeTab === 'payroll' && <motion.div layoutId="hrTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('departments')}
            className={cn(
              "flex-1 px-8 py-5 text-sm font-black uppercase tracking-widest transition-all relative",
              activeTab === 'departments' ? "text-indigo-600 bg-church-soft/30" : "text-church-gray hover:text-church-black"
            )}
          >
            Departments
            {activeTab === 'departments' && <motion.div layoutId="hrTab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />}
          </button>
        </div>

        <div className="p-8">
          {activeTab !== 'departments' && (
            <div className="flex items-center gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-church-gray w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search staff by name or role..."
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-church-soft/50 border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeTab === 'employees' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.role.toLowerCase().includes(searchTerm.toLowerCase())).map(employee => (
                <motion.div 
                  key={employee.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-church-soft/40 rounded-[32px] border border-church-blue/5 group hover:bg-white hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-church-blue flex items-center justify-center text-white text-xl font-black">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-church-black text-lg">{employee.name}</h4>
                          {employee.isDepartmentHead && (
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-black">HEAD</span>
                          )}
                        </div>
                        <p className="text-church-blue text-xs font-black uppercase tracking-wider">{employee.role}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      employee.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {employee.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-white/60 rounded-2xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-church-gray mb-1">Department</p>
                      <p className="text-xs font-bold">{employee.department}</p>
                    </div>
                    <div className="p-3 bg-white/60 rounded-2xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-church-gray mb-1">Monthly Salary</p>
                      <p className="text-xs font-black text-church-blue">{formatCurrency(employee.salary)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-church-blue/5">
                    <div className="flex items-center gap-4">
                        {employee.status === 'Active' ? (
                          getMonthBalance(employee.id!, new Date().toISOString().slice(0, 7)) > 0 ? (
                            <button 
                              onClick={() => handlePayStaff(employee)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                            >
                              <DollarSign className="w-3 h-3" />
                              Pay Salary
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-church-gray rounded-lg text-[10px] font-black uppercase tracking-widest">
                              <Zap className="w-3 h-3 text-emerald-500" />
                              Fully Paid
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-100">
                            <X className="w-3 h-3" />
                            Payroll Disabled
                          </div>
                        )}
                    </div>
                    <button 
                      onClick={() => handleEditEmployee(employee)}
                      className="p-2.5 bg-church-yellow text-church-black rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                      title="Edit Contract"
                    >
                      <Briefcase className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedStaffForHistory(employee);
                        setShowHistoryModal(true);
                      }}
                      className="p-2.5 bg-church-soft text-church-blue rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
                      title="Payment History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : activeTab === 'payroll' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-church-blue text-white text-[10px] font-black uppercase tracking-widest border-b border-white/10">
                    <th className="px-8 py-6">Staff Name</th>
                    <th className="px-8 py-6">Month</th>
                    <th className="px-8 py-6 text-right">Total Salary</th>
                    <th className="px-8 py-6 text-right">Paid Amount</th>
                    <th className="px-8 py-6 text-right">Balance</th>
                    <th className="px-8 py-6">Status</th>
                    <th className="px-8 py-6">Pay Date</th>
                    <th className="px-8 py-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-church-blue/5 font-sans">
                  {groupedPayroll.filter(p => p.employeeName.toLowerCase().includes(searchTerm.toLowerCase())).map(record => {
                    const gross = Number(record.totalSalary) || 0;
                    const paid = Number(record.paidAmount) || 0;
                    const bal = Number(record.balance) || 0;
                    
                    return (
                      <tr key={`${record.employeeId}-${record.month}`} className="hover:bg-church-soft/30 transition-all group">
                        <td className="px-8 py-6">
                          <span className="font-bold text-church-black">{record.employeeName}</span>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-xs font-black bg-blue-50 text-church-blue px-2 py-1 rounded-md">{record.month}</span>
                        </td>
                        <td className="px-8 py-6 text-right font-medium text-church-gray">
                          {formatCurrency(gross)}
                        </td>
                        <td className="px-8 py-6 text-right font-black text-church-blue">
                          {formatCurrency(paid)}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "font-bold text-xs",
                              bal > 0 ? "text-rose-500" : "text-emerald-500"
                            )}>
                              {bal > 0 ? formatCurrency(bal) : 'SETTLED ✓'}
                            </span>
                            {bal > 0 && (
                              <button 
                                onClick={() => handleSettleBalance(record)}
                                className="text-[9px] font-black uppercase text-church-blue flex items-center gap-1 hover:underline mt-1 bg-church-blue/5 px-1.5 py-0.5 rounded"
                              >
                                <Zap className="w-2.5 h-2.5" />
                                Clear UGX {bal.toLocaleString()}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                            record.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700 font-black"
                          )}>
                            {record.status === 'Paid' ? 'FULL PAY' : 'PARTIAL'}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-xs text-church-gray font-bold">
                          {formatDate(record.paymentDate)}
                        </td>
                        <td className="px-8 py-6">
                           <button 
                             onClick={() => {
                               setSelectedPayslip(record);
                               setShowPayslip(true);
                             }}
                             className="flex items-center gap-2 px-3 py-1.5 bg-church-yellow text-church-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                           >
                             <Receipt className="w-3.5 h-3.5" />
                             Payslip
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-black text-church-black">Ministry Departments</h4>
                <div className="flex gap-2">
                  {departments.length === 0 && (
                    <button 
                      onClick={handleInitializeDepts}
                      disabled={submitting}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:scale-105 transition-all"
                    >
                      <Zap className="w-4 h-4 text-church-yellow" />
                      Initialize Defaults
                    </button>
                  )}
                  <button 
                    onClick={() => setShowAddDept(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:scale-105 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Department
                  </button>
                </div>
              </div>

              {departments.length === 0 ? (
                <div className="text-center py-20 bg-church-soft/30 rounded-[40px] border-2 border-dashed border-church-blue/10">
                  <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-church-gray">
                    <Briefcase className="w-8 h-8" />
                  </div>
                  <h5 className="text-lg font-bold text-church-black">No Departments Configured</h5>
                  <p className="text-church-gray text-sm max-w-xs mx-auto mt-2 font-medium">Click the button above to initialize the standard ministry departments or add a custom one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departments.map(dept => {
                    const head = employees.find(e => e.department === dept.name && e.isDepartmentHead);
                    const deptStaff = employees.filter(e => e.department === dept.name);
                    return (
                      <div key={dept.id} className="bg-church-soft/30 p-6 rounded-[32px] border border-church-blue/5 shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-lg font-black text-church-black">{dept.name}</h4>
                          {deptStaff.length === 0 && (
                            <button 
                              onClick={() => handleRemoveDept(dept.id, dept.name)}
                              className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-rose-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black uppercase text-church-gray mb-1 tracking-widest">Department Head</p>
                            {head ? (
                              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-indigo-100">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                                  {head.name.charAt(0)}
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-sm font-bold text-church-black truncate">{head.name}</p>
                                  <p className="text-[10px] text-indigo-600 font-black uppercase">{head.role}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-rose-500 font-bold bg-rose-50 p-3 rounded-2xl italic">No Head Assigned</p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-church-gray mb-1 tracking-widest">Team Size</p>
                            <p className="text-sm font-bold text-church-blue">{deptStaff.length} Staff Member(s)</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showAddDept && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[40px] p-10 w-full max-w-sm shadow-2xl relative">
                    <button onClick={() => setShowAddDept(false)} className="absolute top-6 right-6 p-2 bg-church-soft rounded-lg text-church-gray">
                      <X className="w-4 h-4" />
                    </button>
                    <h3 className="text-xl font-black mb-6">New Department</h3>
                    <form onSubmit={handleAddDept} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Department Name</label>
                        <input 
                          autoFocus
                          required 
                          type="text" 
                          className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                          value={newDeptName} 
                          onChange={e => setNewDeptName(e.target.value)} 
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full bg-church-blue text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting && <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />}
                        {submitting ? 'Creating...' : 'Create Department'}
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => {
                  setEditingEmployee(null);
                  setNewEmployee(initialEmployeeState);
                  setShowAddEmployee(false);
                }} 
                className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray hover:text-church-black transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-black mb-8 text-church-black">{editingEmployee ? 'Edit Staff Contract' : 'New Employee Registration'}</h3>
              
              <form onSubmit={handleAddEmployee} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Full Name</label>
                    <input required type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Appointed Role</label>
                    <input required type="text" placeholder="e.g. Media Lead, Pastor" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Department</label>
                    <select required className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})}>
                      <option value="">Select Department...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Monthly Salary (UGX)</label>
                    <input required type="number" min="0" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-extrabold text-sm text-church-blue" value={newEmployee.salary} onChange={e => setNewEmployee({...newEmployee, salary: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Phone Contact</label>
                    <input required type="text" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.phone} onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Email Address</label>
                    <input type="email" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Date of Joining</label>
                    <input type="date" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.joinedDate} onChange={e => setNewEmployee({...newEmployee, joinedDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Appoint as Head?</label>
                    <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent">
                      <input type="checkbox" id="isHead" className="w-5 h-5 rounded border-2 border-church-blue text-church-blue focus:ring-church-blue/20" checked={newEmployee.isDepartmentHead} onChange={e => setNewEmployee({...newEmployee, isDepartmentHead: e.target.checked})} />
                      <label htmlFor="isHead" className="text-sm font-bold text-church-black cursor-pointer">Yes, Department Head</label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">TIN Number (Optional)</label>
                    <input type="text" placeholder="Tax Identification Number" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.tinNumber} onChange={e => setNewEmployee({...newEmployee, tinNumber: e.target.value})} />
                  </div>
                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Employment Status</label>
                    <select className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newEmployee.status} onChange={e => setNewEmployee({...newEmployee, status: e.target.value as any})}>
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Terminated">Terminated</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Bank Details (Optional)</label>
                  <textarea rows={2} className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm placeholder:font-normal" placeholder="Acc Name, Acc Number, Bank Name..." value={newEmployee.bankDetails} onChange={e => setNewEmployee({...newEmployee, bankDetails: e.target.value})} />
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-church-blue text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-church-blue/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {submitting ? 'Processing...' : editingEmployee ? 'Update Contract' : 'Create Staff Contract'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddPayroll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-church-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-[40px] p-10 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowAddPayroll(false)} className="absolute top-8 right-8 p-3 bg-church-soft rounded-2xl text-church-gray hover:text-church-black transition-colors">
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-black mb-2 text-church-black flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                Process Payment
              </h3>
              <p className="text-church-gray text-sm mb-8 font-medium">Record salary payment for an existing staff member.</p>
              
              <form onSubmit={handleProcessPayroll} className="space-y-6">
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl">
                    {error}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Select Employee</label>
                  <select required className="w-full px-5 py-4 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newPayroll.employeeId} onChange={e => setNewPayroll({...newPayroll, employeeId: e.target.value})}>
                    <option value="">Choose individual...</option>
                    {employees.filter(e => e.status === 'Active').map(emp => {
                      const bal = getMonthBalance(emp.id!, newPayroll.month);
                      return (
                        <option key={emp.id} value={emp.id} disabled={bal <= 0}>
                          {emp.name} {bal <= 0 ? '(Fully Paid)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {newPayroll.employeeId && (
                  <div className="p-4 bg-church-blue/5 rounded-2xl border border-church-blue/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-church-gray uppercase tracking-widest">Gross Monthly Salary</span>
                      <span className="font-black text-church-black">{formatCurrency(employees.find(e => e.id === newPayroll.employeeId)?.salary || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t border-church-blue/10">
                      <span className="font-bold text-church-gray uppercase tracking-widest text-[10px]">Outstanding Balance for {newPayroll.month}</span>
                      <span className={cn(
                        "font-black text-sm",
                        getMonthBalance(newPayroll.employeeId, newPayroll.month) > 0 ? "text-rose-600" : "text-emerald-600"
                      )}>
                        {getMonthBalance(newPayroll.employeeId, newPayroll.month) > 0 
                          ? formatCurrency(getMonthBalance(newPayroll.employeeId, newPayroll.month))
                          : "FULLY SETTLED"
                        }
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Payment Type</label>
                    <select 
                      className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" 
                      value={newPayroll.status} 
                      onChange={e => setNewPayroll({...newPayroll, status: e.target.value as any})}
                    >
                      <option value="Paid">Full Payment (Balance Settlement)</option>
                      <option value="Partial">Partial Payment</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">
                      {newPayroll.status === 'Paid' ? 'Confirmed Amount' : 'Amount to Pay'} (UGX)
                    </label>
                    <input 
                      required 
                      type="number" 
                      min="1"
                      readOnly={newPayroll.status === 'Paid'}
                      className={cn(
                        "w-full px-5 py-3 rounded-xl border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm",
                        newPayroll.status === 'Paid' ? "bg-church-soft text-church-gray cursor-not-allowed" : "bg-white text-church-blue border-church-soft"
                      )}
                      value={newPayroll.status === 'Paid' ? getMonthBalance(newPayroll.employeeId, newPayroll.month) : newPayroll.paidAmount || ''} 
                      onChange={e => setNewPayroll({...newPayroll, paidAmount: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Payroll Month</label>
                    <input type="month" className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newPayroll.month} onChange={e => setNewPayroll({...newPayroll, month: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-church-gray ml-2">Pay Method</label>
                    <select className="w-full px-5 py-3 rounded-xl bg-church-soft border-2 border-transparent focus:border-church-blue/20 transition-all font-bold text-sm" value={newPayroll.paymentMethod} onChange={e => setNewPayroll({...newPayroll, paymentMethod: e.target.value})}>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Cash">Cash Payment</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 italic text-amber-800 text-[10px] font-bold">
                  Note: Transactional records are final. Ensure the Payroll Month is correct before confirming.
                </div>

                <button 
                  type="submit" 
                  disabled={!newPayroll.employeeId || submitting}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {submitting ? 'Processing...' : 'Confirm Payment'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showPayslip && selectedPayslip && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-church-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl relative overflow-hidden my-auto"
            >
              {/* Header Bar */}
              <div className="bg-church-soft/50 px-8 py-4 flex items-center justify-between border-b border-church-soft print:hidden">
                <button 
                  onClick={() => setShowPayslip(false)}
                  className="flex items-center gap-2 text-church-gray hover:text-church-black transition-colors font-black text-[10px] uppercase tracking-widest"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back to Payroll
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={handlePrintPayslip}
                    className="p-2 bg-white text-church-black border border-church-soft rounded-xl hover:bg-church-soft transition-all"
                    title="Download / Print"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowPayslip(false)}
                    className="p-2 bg-white text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-50 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Content */}
              <div className="p-12 relative" id="payslip-content">
                {/* Decorative Watermark */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03]">
                  <div className="w-[400px] h-[400px] border-8 border-church-blue rounded-full flex items-center justify-center">
                    <p className="text-8xl font-black text-church-blue rotate-45">OFFICIAL</p>
                  </div>
                </div>

                <div className="absolute top-0 left-0 w-full h-2 bg-church-blue print:h-4" />
                
                <div className="flex justify-between items-start mb-12">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-church-blue text-white flex items-center justify-center font-black">C</div>
                      <h2 className="text-xl font-black text-church-black tracking-tighter">CHURCH MANAGER</h2>
                    </div>
                    <p className="text-church-blue font-black tracking-[0.2em] text-[10px] uppercase">Official Payment Advice</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-black text-3xl tracking-tighter italic">PAYSLIP</h3>
                    <p className="text-[10px] text-church-gray font-black uppercase tracking-[0.3em]">{selectedPayslip.month}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-10 mb-12 pb-12 border-b-2 border-church-soft border-dashed">
                  <div className="space-y-5">
                    <div className="bg-church-soft/30 p-4 rounded-2xl border border-church-soft/50">
                      <p className="text-[9px] font-black uppercase text-church-gray tracking-widest mb-1.5 leading-none">Employee Details</p>
                      <p className="font-black text-xl text-church-black mb-1">{selectedPayslip.employeeName}</p>
                      <p className="font-bold text-xs text-church-blue uppercase tracking-wider">
                        {employees.find(e => e.id === selectedPayslip.employeeId)?.role || 'N/A'}
                      </p>
                    </div>
                    <div className="px-1">
                      <p className="text-[9px] font-black uppercase text-church-gray tracking-widest mb-1.5 leading-none">Ministry Department</p>
                      <p className="font-bold text-sm">{employees.find(e => e.id === selectedPayslip.employeeId)?.department || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-5 text-right flex flex-col justify-end">
                    <div>
                      <p className="text-[9px] font-black uppercase text-church-gray tracking-widest mb-1 leading-none">Transaction Ref</p>
                      <p className="font-mono text-xs font-bold uppercase tracking-tighter text-slate-400">#CM-{selectedPayslip.id?.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-church-gray tracking-widest mb-1 leading-none">Settlement Method</p>
                      <p className="font-bold text-sm">{selectedPayslip.paymentMethod}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-church-gray tracking-widest mb-1 leading-none">Identification / TIN</p>
                      <p className="font-bold text-sm tracking-widest">{employees.find(e => e.id === selectedPayslip.employeeId)?.tinNumber || 'NON-FILER'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-12">
                  <p className="text-[10px] font-black text-church-gray uppercase tracking-[0.2em] mb-4">Salary Breakdown</p>
                  
                  <div className="flex justify-between items-center py-4 border-b border-church-soft border-dotted">
                    <span className="font-bold text-sm text-slate-600">Basic Monthly Earnings</span>
                    <span className="font-black text-church-black">{formatCurrency(selectedPayslip.totalSalary)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-4 border-b border-church-soft border-dotted">
                    <span className="font-bold text-sm text-slate-600">Deductions / Taxes</span>
                    <span className="font-black text-slate-400">UGX 0.00</span>
                  </div>

                  <div className="flex justify-between items-center bg-church-black text-white p-6 rounded-3xl mt-6 shadow-2xl shadow-church-black/10">
                    <div className="space-y-1">
                      <span className="block font-black uppercase text-[10px] tracking-widest text-slate-400">Net Amount Disbursed</span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{formatDate(selectedPayslip.paymentDate)}</span>
                    </div>
                    <span className="font-black text-3xl">{formatCurrency(selectedPayslip.paidAmount)}</span>
                  </div>

                  {selectedPayslip.balance > 0 && (
                    <div className="flex justify-between items-center px-6 py-4 bg-rose-50 rounded-2xl border border-rose-100/50">
                      <span className="font-black uppercase text-[10px] tracking-widest text-rose-500">Unsettled Balance</span>
                      <span className="font-black text-rose-500">{formatCurrency(selectedPayslip.balance)}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-12 mt-20 text-center">
                  <div className="space-y-4">
                    <div className="h-0.5 bg-church-black/10 w-full" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-church-black mb-1">Employee's Signature</p>
                      <p className="text-[9px] text-church-gray font-medium italic">(Acknowledgment of receipt)</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-0.5 bg-church-black/10 w-full" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-church-black mb-1">Administrative Office</p>
                      <p className="text-[9px] text-church-gray font-bold">STAMP & DATE</p>
                    </div>
                  </div>
                </div>

                {/* Footer disclaimer */}
                <div className="mt-16 pt-8 border-t border-church-soft text-center">
                  <p className="text-[9px] text-church-gray font-bold uppercase tracking-widest">
                    This is a computer generated payslip and does not require a physical signature unless for external purposes.
                  </p>
                </div>
              </div>

              <div className="bg-church-soft/30 p-6 flex gap-4 print:hidden border-t border-church-soft">
                <button 
                  onClick={handlePrintPayslip}
                  className="flex-3 flex items-center justify-center gap-3 bg-church-black text-white py-5 rounded-[24px] font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-church-black/20 transition-all"
                >
                  <Printer className="w-5 h-5 text-emerald-400" />
                  Print & Download Official Copy
                </button>
                <button 
                  onClick={() => setShowPayslip(false)}
                  className="flex-1 flex items-center justify-center gap-3 bg-white text-church-gray border-2 border-church-soft py-5 rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-church-soft transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showHistoryModal && selectedStaffForHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-church-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[40px] w-full max-w-4xl shadow-2xl relative overflow-hidden h-[80vh] flex flex-col">
              <div className="p-8 border-b border-church-soft flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black">
                    {selectedStaffForHistory.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-church-black">{selectedStaffForHistory.name}</h3>
                    <p className="text-xs font-bold text-church-gray uppercase tracking-widest">Payment History Log</p>
                  </div>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-3 bg-church-soft rounded-2xl text-church-gray hover:text-church-black transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="space-y-4">
                  {payroll.filter(p => p.employeeId === selectedStaffForHistory.id).length === 0 ? (
                    <div className="text-center py-20 text-church-gray italic">
                      No payment records found for this staff member.
                    </div>
                  ) : (
                    payroll.filter(p => p.employeeId === selectedStaffForHistory.id).map((record, index) => (
                      <div key={record.id || index} className="flex items-center gap-6 p-6 bg-church-soft/30 rounded-[32px] border border-church-blue/5 hover:bg-white hover:shadow-lg transition-all group">
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                          <div>
                            <p className="text-[10px] font-black uppercase text-church-gray mb-1 tracking-widest">Month</p>
                            <p className="text-sm font-black text-church-blue">{record.month}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-church-gray mb-1 tracking-widest">Amount Paid</p>
                            <p className="text-sm font-black">{formatCurrency(record.paidAmount)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-church-gray mb-1 tracking-widest">Method</p>
                            <p className="text-xs font-bold">{record.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-church-gray mb-1 tracking-widest">Date</p>
                            <p className="text-xs font-bold text-church-gray">{formatDate(record.paymentDate)}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ml-auto",
                          record.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {record.status}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-8 bg-church-soft/30 border-t border-church-soft">
                <div className="flex justify-between items-center font-black">
                  <span className="text-church-gray uppercase tracking-widest text-xs">Total Career Earnings Recieved</span>
                  <span className="text-xl text-emerald-600">
                    {formatCurrency(
                      payroll
                        .filter(p => p.employeeId === selectedStaffForHistory.id)
                        .reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0)
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
