import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Mail, Sliders, Settings, Plus, Trash2, Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

type Tab = 'usuarios' | 'gerentes' | 'limites' | 'config';

interface Manager { id: string; regional: string; nome: string; email: string; ativo: boolean; }
interface Config { key: string; value: string; }
interface AppUser { id: string; email: string; role: string; created_at: string; }

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('usuarios');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Check admin role
  const isAdmin = user?.user_metadata?.role === 'admin';

  // State
  const [users, setUsers] = useState<AppUser[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState('viewer');
  const [creatingUser, setCreatingUser] = useState(false);

  // New manager form
  const [newManager, setNewManager] = useState({ regional: '', nome: '', email: '' });
  const [addingManager, setAddingManager] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load managers
      const { data: mgrs } = await supabase.from('regional_managers').select('*').order('regional');
      setManagers(mgrs || []);

      // Load config
      const { data: cfg } = await supabase.from('system_config').select('*');
      const cfgMap: Record<string, string> = {};
      (cfg || []).forEach((c: Config) => { cfgMap[c.key] = c.value; });
      setConfig(cfgMap);

      // Load users via admin API
      const { data: usersData, error } = await supabase.functions.invoke('list-users');
      if (!error && usersData?.users) setUsers(usersData.users);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveConfig = async (key: string, value: string) => {
    const { error } = await supabase.from('system_config').upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) { showToast('Erro ao salvar configuração', 'error'); return; }
    setConfig(prev => ({ ...prev, [key]: value }));
    showToast('Configuração salva!');
  };

  const saveAllLimits = async () => {
    const keys = ['cmv_danger', 'cmv_warning', 'mdo_danger', 'mdo_warning', 'adm_limit'];
    for (const key of keys) {
      await supabase.from('system_config').upsert({ key, value: config[key] ?? '', updated_at: new Date().toISOString() });
    }
    showToast('Limites salvos com sucesso!');
  };

  const saveAllConfig = async () => {
    const keys = ['system_name', 'email_day'];
    for (const key of keys) {
      await supabase.from('system_config').upsert({ key, value: config[key] ?? '', updated_at: new Date().toISOString() });
    }
    showToast('Configurações salvas!');
  };

  const createUser = async () => {
    if (!newEmail || !newPassword) { showToast('Preencha e-mail e senha', 'error'); return; }
    setCreatingUser(true);
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: newEmail, password: newPassword, role: newRole },
    });
    setCreatingUser(false);
    if (error || data?.error) { showToast(data?.error || 'Erro ao criar usuário', 'error'); return; }
    showToast(`Usuário ${newEmail} criado!`);
    setNewEmail(''); setNewPassword(''); setNewRole('viewer');
    loadData();
  };

  const deleteManager = async (id: string) => {
    const { error } = await supabase.from('regional_managers').delete().eq('id', id);
    if (error) { showToast('Erro ao remover gerente', 'error'); return; }
    setManagers(prev => prev.filter(m => m.id !== id));
    showToast('Gerente removido!');
  };

  const toggleManager = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('regional_managers').update({ ativo: !ativo }).eq('id', id);
    if (error) { showToast('Erro ao atualizar', 'error'); return; }
    setManagers(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m));
    showToast(!ativo ? 'Gerente ativado!' : 'Gerente desativado!');
  };

  const addManager = async () => {
    if (!newManager.regional || !newManager.nome || !newManager.email) {
      showToast('Preencha todos os campos', 'error'); return;
    }
    setAddingManager(true);
    const { data, error } = await supabase.from('regional_managers')
      .insert({ ...newManager, ativo: true }).select().single();
    setAddingManager(false);
    if (error) { showToast('Erro ao adicionar gerente', 'error'); return; }
    setManagers(prev => [...prev, data]);
    setNewManager({ regional: '', nome: '', email: '' });
    showToast('Gerente adicionado!');
  };

  const updateManager = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from('regional_managers').update({ [field]: value } as never).eq('id', id);
    if (error) { showToast('Erro ao salvar', 'error'); return; }
    setManagers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    showToast('Salvo!');
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Shield className="w-12 h-12 text-muted-foreground opacity-40" />
        <p className="text-lg font-semibold text-muted-foreground">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'usuarios', label: 'Usuários', icon: Users },
    { key: 'gerentes', label: 'Gerentes Regionais', icon: Mail },
    { key: 'limites', label: 'Limites de Alertas', icon: Sliders },
    { key: 'config', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito — Superintendente</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <>
          {/* USUÁRIOS */}
          {tab === 'usuarios' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Criar novo usuário */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Criar novo usuário
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@maissabor.ind.br" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha</Label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-secondary border-border pr-9" />
                      <button onClick={() => setShowPassword(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Perfil</Label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-border bg-secondary text-sm">
                      <option value="viewer">Visualizador</option>
                      <option value="manager">Gerente Regional</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={createUser} disabled={creatingUser} className="w-full gap-2">
                      {creatingUser ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Criar usuário
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de usuários */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Usuários cadastrados ({users.length})
                  </h3>
                </div>
                {users.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado. A listagem requer a Edge Function list-users.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">E-mail</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Perfil</th>
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id} className="border-t border-border/50 hover:bg-secondary/30">
                          <td className="p-3 font-medium">{u.email}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-primary/10 text-primary' : u.role === 'manager' ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>
                              {u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Gerente' : 'Visualizador'}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}

          {/* GERENTES REGIONAIS */}
          {tab === 'gerentes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Adicionar gerente */}
              <div className="glass-card rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Adicionar gerente regional
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Regional</Label>
                    <Input value={newManager.regional} onChange={e => setNewManager(p => ({ ...p, regional: e.target.value.toUpperCase() }))} placeholder="Ex: TOCANTINS" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input value={newManager.nome} onChange={e => setNewManager(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do gerente" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={newManager.email} onChange={e => setNewManager(p => ({ ...p, email: e.target.value }))} placeholder="email@maissabor.ind.br" className="bg-secondary border-border" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addManager} disabled={addingManager} className="w-full gap-2">
                      {addingManager ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de gerentes */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Gerentes cadastrados ({managers.length})
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Regional</th>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Nome</th>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">E-mail</th>
                      <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.map(m => (
                      <tr key={m.id} className="border-t border-border/50 hover:bg-secondary/30">
                        <td className="p-3">
                          <Input defaultValue={m.regional} onBlur={e => { if (e.target.value !== m.regional) updateManager(m.id, 'regional', e.target.value.toUpperCase()); }}
                            className="bg-transparent border-transparent hover:border-border focus:border-primary h-7 text-xs font-semibold w-32" />
                        </td>
                        <td className="p-3">
                          <Input defaultValue={m.nome} onBlur={e => { if (e.target.value !== m.nome) updateManager(m.id, 'nome', e.target.value); }}
                            className="bg-transparent border-transparent hover:border-border focus:border-primary h-7 text-xs w-40" />
                        </td>
                        <td className="p-3">
                          <Input defaultValue={m.email} onBlur={e => { if (e.target.value !== m.email) updateManager(m.id, 'email', e.target.value); }}
                            className="bg-transparent border-transparent hover:border-border focus:border-primary h-7 text-xs w-52" />
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => toggleManager(m.id, m.ativo)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${m.ativo ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}>
                            {m.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteManager(m.id)} className="text-muted-foreground hover:text-danger transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* LIMITES DE ALERTAS */}
          {tab === 'limites' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="glass-card rounded-xl p-6 space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Limites para geração de alertas
                </h3>

                {/* CMV */}
                <div className="space-y-4 pb-6 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CMV (%)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Alerta de Atenção 🟡</Label>
                        <span className="text-sm font-bold text-warning">{config.cmv_warning ?? '40'}%</span>
                      </div>
                      <input type="range" min="20" max="60" step="1" value={config.cmv_warning ?? '40'}
                        onChange={e => setConfig(p => ({ ...p, cmv_warning: e.target.value }))}
                        className="w-full accent-warning" />
                      <p className="text-[10px] text-muted-foreground">CMV acima desse valor gera alerta de atenção</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Alerta Crítico 🔴</Label>
                        <span className="text-sm font-bold text-danger">{config.cmv_danger ?? '50'}%</span>
                      </div>
                      <input type="range" min="30" max="80" step="1" value={config.cmv_danger ?? '50'}
                        onChange={e => setConfig(p => ({ ...p, cmv_danger: e.target.value }))}
                        className="w-full accent-danger" />
                      <p className="text-[10px] text-muted-foreground">CMV acima desse valor gera alerta crítico</p>
                    </div>
                  </div>
                </div>

                {/* Mão de Obra */}
                <div className="space-y-4 pb-6 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mão de Obra (%)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Alerta de Atenção 🟡</Label>
                        <span className="text-sm font-bold text-warning">{config.mdo_warning ?? '30'}%</span>
                      </div>
                      <input type="range" min="10" max="50" step="1" value={config.mdo_warning ?? '30'}
                        onChange={e => setConfig(p => ({ ...p, mdo_warning: e.target.value }))}
                        className="w-full accent-warning" />
                      <p className="text-[10px] text-muted-foreground">MdO acima desse valor gera alerta de atenção</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Alerta Crítico 🔴</Label>
                        <span className="text-sm font-bold text-danger">{config.mdo_danger ?? '35'}%</span>
                      </div>
                      <input type="range" min="15" max="60" step="1" value={config.mdo_danger ?? '35'}
                        onChange={e => setConfig(p => ({ ...p, mdo_danger: e.target.value }))}
                        className="w-full accent-danger" />
                      <p className="text-[10px] text-muted-foreground">MdO acima desse valor gera alerta crítico</p>
                    </div>
                  </div>
                </div>

                {/* ADM */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Limite ADM / Receita (%)</p>
                  <div className="max-w-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Limite máximo 🔴</Label>
                      <span className="text-sm font-bold text-danger">{config.adm_limit ?? '4'}%</span>
                    </div>
                    <input type="range" min="1" max="20" step="0.5" value={config.adm_limit ?? '4'}
                      onChange={e => setConfig(p => ({ ...p, adm_limit: e.target.value }))}
                      className="w-full accent-danger" />
                    <p className="text-[10px] text-muted-foreground">% ADM/Receita acima desse valor gera alerta no Dashboard ADM</p>
                  </div>
                </div>

                <Button onClick={saveAllLimits} className="gap-2 w-full sm:w-auto">
                  <Save className="w-4 h-4" /> Salvar todos os limites
                </Button>
              </div>
            </motion.div>
          )}

          {/* CONFIGURAÇÕES GERAIS */}
          {tab === 'config' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="glass-card rounded-xl p-6 space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Configurações gerais do sistema
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Nome do sistema</Label>
                    <Input value={config.system_name ?? 'FinanceHub — Mais Sabor'}
                      onChange={e => setConfig(p => ({ ...p, system_name: e.target.value }))}
                      className="bg-secondary border-border" />
                    <p className="text-[10px] text-muted-foreground">Aparece no header e nos relatórios</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Dia de envio do e-mail semanal</Label>
                    <select value={config.email_day ?? '1'}
                      onChange={e => setConfig(p => ({ ...p, email_day: e.target.value }))}
                      className="w-full h-9 px-3 rounded-md border border-border bg-secondary text-sm">
                      <option value="0">Domingo</option>
                      <option value="1">Segunda-feira</option>
                      <option value="2">Terça-feira</option>
                      <option value="3">Quarta-feira</option>
                      <option value="4">Quinta-feira</option>
                      <option value="5">Sexta-feira</option>
                      <option value="6">Sábado</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground">O relatório será enviado às 8h no dia selecionado</p>
                  </div>
                </div>

                {/* Info sobre domínio e-mail */}
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 space-y-1">
                  <p className="text-xs font-semibold text-warning">⚠️ Domínio de e-mail pendente</p>
                  <p className="text-xs text-muted-foreground">
                    O domínio <strong>maissabor.ind.br</strong> precisa ser verificado no Resend para os e-mails chegarem com remetente correto.
                    Atualmente está usando <strong>onboarding@resend.dev</strong>.
                  </p>
                </div>

                <Button onClick={saveAllConfig} className="gap-2 w-full sm:w-auto">
                  <Save className="w-4 h-4" /> Salvar configurações
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
