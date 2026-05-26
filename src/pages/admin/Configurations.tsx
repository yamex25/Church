import { useEffect, useState } from 'react';
import { Info, Save } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '@/src/components/AuthContext';

export default function Configurations() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    const settingsDoc = doc(db, 'configs', 'contributions');
    const unsubscribe = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) setSettings(snap.data());
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'configs/contributions'));

    return () => unsubscribe();
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((s: any) => ({ ...s, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsDoc = doc(db, 'configs', 'contributions');
      await setDoc(settingsDoc, settings, { merge: true });
      setSaving(false);
      alert('Configuration saved.');
    } catch (error) {
      setSaving(false);
      handleFirestoreError(error, OperationType.WRITE, 'configs/contributions');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black">Contributions Configuration</h2>
          <p className="text-xs text-church-gray mt-1">Manage contribution channels and contact details shown in the member portal.</p>
        </div>
        <div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-church-yellow rounded-2xl font-bold shadow-md"
          >
            <Save className="w-4 h-4 inline-block mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-church-blue/10">
          <h3 className="font-bold text-church-blue">Mobile Money</h3>
          <label className="block text-xs text-church-gray mt-3">Church Mobile Number</label>
          <input value={settings?.mobileNumber || ''} onChange={(e) => handleChange('mobileNumber', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
          <label className="block text-xs text-church-gray mt-3">Merchant / Paybill Code</label>
          <input value={settings?.merchantCode || ''} onChange={(e) => handleChange('merchantCode', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
        </div>

        <div className="p-6 bg-white rounded-2xl border border-church-blue/10">
          <h3 className="font-bold text-church-blue">Bank Details</h3>
          <label className="block text-xs text-church-gray mt-3">Bank Name</label>
          <input value={settings?.bankName || ''} onChange={(e) => handleChange('bankName', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
          <label className="block text-xs text-church-gray mt-3">Account Name</label>
          <input value={settings?.bankAccountName || ''} onChange={(e) => handleChange('bankAccountName', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
          <label className="block text-xs text-church-gray mt-3">Account Number</label>
          <input value={settings?.bankAccountNumber || ''} onChange={(e) => handleChange('bankAccountNumber', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
        </div>

        <div className="p-6 bg-white rounded-2xl border border-church-blue/10 md:col-span-2">
          <h3 className="font-bold text-church-blue">Finance Contact</h3>
          <label className="block text-xs text-church-gray mt-3">Help Phone</label>
          <input value={settings?.helpPhone || ''} onChange={(e) => handleChange('helpPhone', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
          <label className="block text-xs text-church-gray mt-3">Help Email</label>
          <input value={settings?.helpEmail || ''} onChange={(e) => handleChange('helpEmail', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft" />
          <label className="block text-xs text-church-gray mt-3">Additional Info / Instructions</label>
          <textarea value={settings?.additionalInfo || ''} onChange={(e) => handleChange('additionalInfo', e.target.value)} className="w-full p-3 mt-1 rounded-lg bg-church-soft h-24" />
        </div>
      </div>

    </div>
  );
}
