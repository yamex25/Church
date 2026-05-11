import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  CheckCircle2, 
  XCircle, 
  User, 
  Clock,
  Search,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AttendanceScan() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        /* verbose= */ false
      );

      scanner.render((result) => {
        handleScanSuccess(result);
        scanner.clear();
        setIsScanning(false);
      }, (error) => {
        // ignore errors
      });

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
      }
    };
  }, [isScanning]);

  const handleScanSuccess = (decodedText: string) => {
    setScanResult(decodedText);
    // Add to recent list (Mocking data for now)
    const newScan = {
      id: Date.now(),
      memberName: 'John Smith', // In real app, fetch from Firestore using ID
      memberId: decodedText,
      timestamp: new Date().toLocaleTimeString(),
      status: 'Success'
    };
    setRecentScans([newScan, ...recentScans]);
    
    // Auto reset success message after 3 seconds
    setTimeout(() => {
      setScanResult(null);
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
        <h2 className="text-2xl font-bold mb-2">QR Attendance Scanner</h2>
        <p className="text-slate-500 mb-8">Scan a member's QR code to mark them as present for the current service.</p>

        <div className="flex justify-center mb-8">
          {!isScanning ? (
            <button 
              onClick={() => setIsScanning(true)}
              className="flex items-center gap-3 bg-blue-600 text-white px-8 py-6 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl hover:scale-105 active:scale-95"
            >
              <Camera className="w-6 h-6" />
              Start Scanning
            </button>
          ) : (
            <div className="w-full max-w-sm">
              <div id="reader" className="overflow-hidden rounded-2xl shadow-inner border-4 border-blue-100 h-[300px]"></div>
              <button 
                onClick={() => setIsScanning(false)}
                className="mt-4 text-slate-500 font-medium hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {scanResult && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-center gap-3 max-w-sm mx-auto"
            >
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <p className="font-bold">Member Checked In!</p>
                <p className="text-sm opacity-80">ID: {scanResult}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Recent Scans
            </h3>
            <span className="text-xs text-slate-400">Live Updates</span>
          </div>
          
          <div className="space-y-3">
            {recentScans.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>No scans recorded yet</p>
              </div>
            ) : (
              recentScans.map((scan) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={scan.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{scan.memberName}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{scan.memberId}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{scan.timestamp}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 mb-6">
            <Search className="w-5 h-5 text-blue-600" />
            Manual Search
          </h3>
          <p className="text-sm text-slate-500 mb-4">Search by name or email if the member doesn't have their QR code.</p>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Searching members..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
            />
          </div>
          <div className="p-4 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-400 text-sm italic">
            Search results will appear here
          </div>
        </div>
      </div>
    </div>
  );
}
