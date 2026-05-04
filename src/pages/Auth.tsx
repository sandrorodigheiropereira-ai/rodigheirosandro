import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Loader2 } from 'lucide-react';

const schema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72),
});

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Login | FinanceHub';
    const { data } = supabase.storage.from('branding').getPublicUrl('logo.jpg');
    fetch(data.publicUrl, { method: 'HEAD' }).then(r => {
      if (r.ok) setLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
    }).catch(() => {});
  }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: 'Erro', description: parsed.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Falha no login', description: error, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden border">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo da empresa" className="w-full h-full object-contain" />
            ) : (
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl">FinanceHub</CardTitle>
            <CardDescription>Acesse sua conta para continuar</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Entrar
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Acesso restrito. Solicite credenciais ao administrador.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
