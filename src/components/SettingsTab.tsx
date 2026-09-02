import React, { useState, useRef } from 'react';
import { MembershipPlan, db } from '../db/db';
import { defaultTheme } from '../config/theme';
import { Card, Button, Input } from './ui/shadcn';
import { Globe, Bell, Plus, Pencil, Trash2, Check, X, Database, Download, Upload, ShieldCheck } from 'lucide-react';
import { SupportedLanguage, translations } from '../utils/i18n';
import { sendNativeNotification } from '../utils/notifications';

interface SettingsTabProps {
  plans: MembershipPlan[];
  onPlansUpdated: () => void;
  lang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
}

export function SettingsTab({
  plans,
  onPlansUpdated,
  lang,
  onLanguageChange,
  notificationsEnabled,
  onToggleNotifications
}: SettingsTabProps) {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState(1);
  const [editPrice, setEditPrice] = useState(250);

  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState(1);
  const [newPrice, setNewPrice] = useState(250);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const startEdit = (plan: MembershipPlan) => {
    setEditingPlanId(plan.id);
    setEditName(plan.name);
    setEditDuration(plan.durationMonths);
    setEditPrice(plan.price);
  };

  const saveEdit = async (planId: string) => {
    if (!editName.trim()) return;
    await db.plans.update(planId, {
      name: editName.trim(),
      durationMonths: Number(editDuration),
      price: Number(editPrice)
    });
    setEditingPlanId(null);
    onPlansUpdated();
  };

  const deletePlan = async (planId: string, planName: string) => {
    if (plans.length <= 1) {
      alert('Au moins une formule doit rester active.');
      return;
    }
    if (window.confirm(`Supprimer la formule "${planName}" ?`)) {
      await db.plans.delete(planId);
      onPlansUpdated();
    }
  };

  const handleAddNewPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newPlan: MembershipPlan = {
      id: `plan_${Date.now()}`,
      name: newName.trim(),
      durationMonths: Number(newDuration),
      price: Number(newPrice),
      description: 'Formule standard',
      features: ['Accès Musculation & Cardio']
    };

    await db.plans.add(newPlan);
    setNewName('');
    setShowAddPlan(false);
    onPlansUpdated();
  };

  const handleTestNotification = async () => {
    await sendNativeNotification(
      `${t.appName} - Alerte`,
      `Test réussi! Vos notifications d'échéances et cotisations sont actives.`
    );
  };

  // Full Database Backup Export (JSON file)
  const handleExportBackup = async () => {
    try {
      const [allMembers, allPlans, allCheckIns, allPayments] = await Promise.all([
        db.members.toArray(),
        db.plans.toArray(),
        db.checkIns.toArray(),
        db.payments.toArray()
      ]);

      const backupData = {
        app: 'Club Al Oussoud',
        version: 3,
        exportedAt: new Date().toISOString(),
        data: {
          members: allMembers,
          plans: allPlans,
          checkIns: allCheckIns,
          payments: allPayments
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Club_Al_Oussoud_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupStatus(t.backupSuccess);
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err) {
      console.error('Backup error:', err);
      alert('Erreur lors de la création de la sauvegarde.');
    }
  };

  // Restore Database Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.data || !Array.isArray(json.data.members)) {
          alert('Fichier de sauvegarde invalide.');
          return;
        }

        if (window.confirm('Attention: La restauration écrasera et fusionnera les données. Continuer ?')) {
          await db.transaction('rw', db.members, db.plans, db.checkIns, db.payments, async () => {
            if (json.data.members.length > 0) {
              await db.members.bulkPut(json.data.members);
            }
            if (json.data.plans.length > 0) {
              await db.plans.bulkPut(json.data.plans);
            }
            if (json.data.checkIns.length > 0) {
              await db.checkIns.bulkPut(json.data.checkIns);
            }
            if (json.data.payments.length > 0) {
              await db.payments.bulkPut(json.data.payments);
            }
          });

          onPlansUpdated();
          alert('Restauration des données réussie !');
        }
      } catch (err) {
        console.error('Restore error:', err);
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Language Selection Segmented Control */}
      <Card className="p-4 border-zinc-800/80 bg-zinc-900/60">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-orange-500" />
          <h4 className="text-xs font-semibold text-zinc-100">{t.languageSetting}</h4>
        </div>

        <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1 gap-1">
          {[
            { code: 'ar', label: 'العربية (Arabic)' },
            { code: 'fr', label: 'Français' },
            { code: 'en', label: 'English' }
          ].map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => onLanguageChange(item.code as SupportedLanguage)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                lang === item.code
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 2. System Push Notifications Toggle & Test */}
      <Card className="p-4 border-zinc-800/80 bg-zinc-900/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-500" />
              <h4 className="text-xs font-semibold text-zinc-100">{t.notificationsTitle}</h4>
            </div>
            <p className="text-[11px] text-zinc-400">{t.notificationsDesc}</p>
          </div>

          <button
            type="button"
            onClick={() => onToggleNotifications(!notificationsEnabled)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              notificationsEnabled ? 'bg-orange-500 justify-end' : 'bg-zinc-800 justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-zinc-950 shadow-sm" />
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleTestNotification}
          className="w-full h-8 text-xs border-zinc-800 hover:bg-zinc-800 text-orange-400"
        >
          {t.testNotification}
        </Button>
      </Card>

      {/* 3. Subscription Plan Manager CRUD */}
      <Card className="p-4 border-zinc-800/80 bg-zinc-900/60 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-zinc-100">{t.planManagerTitle}</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">{t.planManagerDesc}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddPlan(!showAddPlan)}
            className="h-7 text-xs border-zinc-800 text-orange-400 hover:border-orange-500/40 gap-1 px-2.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addPlan}</span>
          </Button>
        </div>

        {/* Add Plan Form */}
        {showAddPlan && (
          <form onSubmit={handleAddNewPlan} className="rounded-lg border border-zinc-750 bg-zinc-950/80 p-3 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400">+ {t.planName}</span>
              <button type="button" onClick={() => setShowAddPlan(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <Input
              placeholder={t.planName}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-xs"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="1"
                max="36"
                placeholder={t.planDuration}
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="h-8 text-xs"
                required
              />
              <Input
                type="number"
                min="0"
                placeholder={t.planPrice}
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="h-8 text-xs font-mono"
                required
              />
            </div>

            <Button type="submit" size="sm" variant="default" className="w-full h-8 text-xs">
              {t.savePlan}
            </Button>
          </form>
        )}

        {/* Plans List */}
        <div className="space-y-2">
          {plans.map((plan) => {
            const isEditing = editingPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className="rounded-lg border border-zinc-800/90 bg-zinc-950/50 p-2.5 text-xs flex flex-col gap-2"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(Number(e.target.value))}
                        className="h-7 text-xs"
                      />
                      <Input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value))}
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => saveEdit(plan.id)}
                        className="flex-1 h-7 text-xs"
                      >
                        Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlanId(null)}
                        className="h-7 text-xs"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-200">{plan.name}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {plan.durationMonths} mois • <span className="font-mono text-orange-400 font-bold">{plan.price} {t.currency}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(plan)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id, plan.name)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 4. Data Safety & Backup Center */}
      <Card className="p-4 border-zinc-800/80 bg-zinc-900/60 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-500" />
          <h4 className="text-xs font-semibold text-zinc-100">{t.backupTitle}</h4>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {t.backupDesc}
        </p>

        {backupStatus && (
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>{backupStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportBackup}
            className="h-9 text-xs border-zinc-800 hover:bg-zinc-800 text-zinc-200 gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            <span>{t.exportBackup}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 text-xs border-zinc-800 hover:bg-zinc-800 text-zinc-200 gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.importBackup}</span>
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportBackup}
            accept=".json"
            className="hidden"
          />
        </div>

        <div className="pt-2 border-t border-zinc-800/80">
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (window.confirm('Voulez-vous réinitialiser et vider la liste des membres pour commencer à zéro ?')) {
                await db.members.clear();
                await db.checkIns.clear();
                await db.payments.clear();
                onPlansUpdated();
                alert('La base de données a été vidée avec succès !');
              }
            }}
            className="w-full h-8 text-xs font-bold gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider la base de données (Départ à zéro)</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
