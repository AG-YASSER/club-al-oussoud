import React, { useState, useRef } from 'react';
import { MembershipPlan, db } from '../db/db';
import { defaultTheme } from '../config/theme';
import { Card, Button, Input } from './ui/shadcn';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Globe,
  Bell,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Database,
  Download,
  Upload,
  ShieldCheck,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { SupportedLanguage, translations } from '../utils/i18n';
import { sendNativeNotification } from '../utils/notifications';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

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
  const t = translations[lang] || translations.fr;
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

  // App-styled Modals
  const [showLangModal, setShowLangModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showClearDbModal, setShowClearDbModal] = useState(false);

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
      alert(t.onePlanMinError || 'Au moins une formule doit rester active.');
      return;
    }
    setPlanToDelete({ id: planId, name: planName });
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
    setNewDuration(1);
    setNewPrice(250);
    setShowAddPlan(false);
    onPlansUpdated();
  };

  // Full Database Backup Export (JSON file)
  const handleExportBackup = async () => {
    try {
      const [allMembers, allPlans, allSubscriptions, allPayments] = await Promise.all([
        db.members.toArray(),
        db.plans.toArray(),
        db.subscriptions.toArray(),
        db.payments.toArray()
      ]);

      const backupData = {
        app: 'Club Al Oussoud',
        version: 3,
        exportedAt: new Date().toISOString(),
        data: {
          members: allMembers,
          plans: allPlans,
          subscriptions: allSubscriptions,
          payments: allPayments
        }
      };

      const fileName = `Club_Al_Oussoud_Backup_${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = JSON.stringify(backupData, null, 2);

      // Try Native Mobile File Share / Save first (Android & iOS)
      try {
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        // Open native share sheet so user can send via WhatsApp, Drive, Save to Files, etc.
        await Share.share({
          title: 'Sauvegarde Club Al Oussoud',
          text: 'Fichier de sauvegarde de la base de données Club Al Oussoud',
          url: fileResult.uri,
          dialogTitle: 'Sauvegarder ou envoyer le fichier JSON'
        });
      } catch (nativeErr) {
        // Web / Browser Fallback: Direct Blob Download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setBackupStatus(t.backupJsonSuccess || 'Sauvegarde JSON générée avec succès !');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (err) {
      console.error(err);
      alert(t.backupExportError || 'Erreur lors de l export de la sauvegarde.');
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
          alert(t.backupInvalidFile || 'Fichier de sauvegarde invalide.');
          return;
        }

        await db.transaction('rw', db.members, db.plans, db.subscriptions, db.payments, async () => {
          if (json.data.members?.length > 0) await db.members.bulkPut(json.data.members);
          if (json.data.plans?.length > 0) await db.plans.bulkPut(json.data.plans);
          if (json.data.subscriptions?.length > 0) await db.subscriptions.bulkPut(json.data.subscriptions);
          if (json.data.payments?.length > 0) await db.payments.bulkPut(json.data.payments);
        });

        onPlansUpdated();
        setBackupStatus(t.backupRestoreSuccess || 'Restauration des données terminée avec succès !');
        setTimeout(() => setBackupStatus(null), 4000);
      } catch (err) {
        console.error(err);
        alert(t.backupReadError || 'Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Language Selection - Modal Trigger */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-[var(--primary)]" />
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">{t.languageSetting || 'Langue du Système'}</h4>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {lang === 'fr' ? 'Français' : lang === 'ar' ? 'العربية' : 'English'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLangModal(true)}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
          >
            <span>{lang.toUpperCase()}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
        </div>
      </Card>

      {/* 2. System Push Notifications Toggle */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--primary)]" />
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t.notificationsTitle}</h4>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{t.notificationsDesc}</p>
          </div>

          <button
            type="button"
            onClick={() => onToggleNotifications(!notificationsEnabled)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              notificationsEnabled ? 'bg-[var(--primary)] justify-end' : 'bg-[var(--surface)] border border-[var(--border)] justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[var(--text-primary)] shadow-sm" />
          </button>
        </div>
      </Card>

      {/* 3. Subscription Plans Management */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t.plansTitle || 'Tarifs & Formules'}</h4>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddPlan(!showAddPlan)}
            className="h-7 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            <Plus className="w-3 h-3 mr-1 text-[var(--primary)]" />
            {showAddPlan ? (t.closeAction || 'Fermer') : (t.newPlanBtn || 'Nouveau Tarif')}
          </Button>
        </div>

        {showAddPlan && (
          <form onSubmit={handleAddNewPlan} className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl space-y-3">
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] block mb-1">{t.packNameLabel || 'Nom du pack'}</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Pack 1 Mois"
                className="h-8 text-xs bg-[var(--card)]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">{t.packDurationLabel || 'Durée (Mois)'}</label>
                <Input
                  type="number"
                  min="1"
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="h-8 text-xs bg-[var(--card)]"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] block mb-1">{t.packPriceLabel || 'Prix (DH)'}</label>
                <Input
                  type="number"
                  min="1"
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  className="h-8 text-xs bg-[var(--card)]"
                  required
                />
              </div>
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)]">
              {t.savePlanBtn || 'Enregistrer le Tarif'}
            </Button>
          </form>
        )}

        <div className="space-y-1.5 pt-1">
          {plans.map((plan) => {
            const isEditing = editingPlanId === plan.id;
            return (
              <div key={plan.id} className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-xs bg-[var(--card)]"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={editDuration}
                        onChange={(e) => setEditDuration(Number(e.target.value))}
                        className="h-7 text-xs bg-[var(--card)]"
                      />
                      <Input
                        type="number"
                        min="1"
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value))}
                        className="h-7 text-xs bg-[var(--card)]"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setEditingPlanId(null)} className="h-7 text-xs">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(plan.id)} className="h-7 text-xs bg-[var(--success)] text-white hover:opacity-90">
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] block">{plan.name}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {t.planMonthsLabel ? t.planMonthsLabel(plan.durationMonths) : `${plan.durationMonths} mois`} • <strong className="text-[var(--primary)]">{plan.price} {t.currency}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(plan)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--surface-hover)]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id, plan.name)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] rounded-md hover:bg-[var(--danger-bg)]"
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
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[var(--primary)]" />
          <h4 className="text-xs font-semibold text-[var(--text-primary)]">{t.backupTitle}</h4>
        </div>

        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          {t.backupDesc}
        </p>

        {backupStatus && (
          <div className="p-2 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)] text-xs font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>{backupStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBackup}
            className="w-full h-8 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          >
            <Download className="w-3 h-3 mr-1" />
            {t.backupDownloadBtn || 'Sauvegarder JSON'}
          </Button>

          <label className="w-full">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <div className="w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs flex items-center justify-center cursor-pointer font-medium">
              <Upload className="w-3 h-3 mr-1" />
              {t.backupRestoreBtn || 'Restaurer JSON'}
            </div>
          </label>
        </div>

        <div className="pt-2 border-t border-[var(--border)]">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowClearDbModal(true)}
            className="w-full h-9 text-xs font-bold gap-1.5 bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white border border-[var(--danger-border)] transition-all active:scale-98"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.wipeDbBtn || 'Vider la base de données (Départ à zéro)'}</span>
          </Button>
        </div>
      </Card>

      {/* Sleek App-Styled Language Modal */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-[var(--card-solid)] border border-[var(--border)] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.systemLanguageTitle || 'Langue du Système'}</h3>
              </div>
              <button onClick={() => setShowLangModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { code: 'fr', name: 'Français', label: 'Français (FR)' },
                { code: 'ar', name: 'العربية', label: 'العربية (AR)' },
                { code: 'en', name: 'English', label: 'English (EN)' }
              ].map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onLanguageChange(item.code as SupportedLanguage);
                    setShowLangModal(false);
                  }}
                  className={`w-full p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                    lang === item.code
                      ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span>{item.label}</span>
                  {lang === item.code && <Check className="w-4 h-4 text-[var(--primary)]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reusable ConfirmDialog for Plan Deletion */}
      <ConfirmDialog
        isOpen={!!planToDelete}
        title={t.deletePlanModalTitle || 'Supprimer cette formule ?'}
        description={
          planToDelete
            ? (t.deletePlanModalDesc ? t.deletePlanModalDesc(planToDelete.name) : `Êtes-vous sûr de vouloir supprimer définitivement la formule "${planToDelete.name}" ?`)
            : ''
        }
        confirmLabel={t.deleteAction || 'Supprimer'}
        cancelLabel={t.cancelBtn || 'Annuler'}
        variant="danger"
        lang={lang}
        onConfirm={async () => {
          if (planToDelete) {
            await db.plans.delete(planToDelete.id);
            onPlansUpdated();
            setPlanToDelete(null);
          }
        }}
        onCancel={() => setPlanToDelete(null)}
      />

      {/* Reusable ConfirmDialog for Database Wipe (Reset) */}
      <ConfirmDialog
        isOpen={showClearDbModal}
        title={t.clearDbModalTitle || 'Vider la base de données ?'}
        description={t.clearDbModalDesc || 'Cette action est irréversible. Tous les membres, pointages et paiements seront supprimés pour commencer à zéro.'}
        confirmLabel={t.clearDbConfirmBtn || 'Tout Réinitialiser'}
        cancelLabel={t.cancelBtn || 'Annuler'}
        variant="danger"
        lang={lang}
        onConfirm={async () => {
          await db.members.clear();
          await db.subscriptions.clear();
          await db.payments.clear();
          setShowClearDbModal(false);
          onPlansUpdated();
          setBackupStatus(t.dbResetSuccessToast || 'Base de données réinitialisée à zéro avec succès !');
          setTimeout(() => setBackupStatus(null), 4000);
        }}
        onCancel={() => setShowClearDbModal(false)}
      />
    </div>
  );
}
