import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import logoInova from '@/assets/logo-inova.png';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Allow login by username only (auto-append @inova.mov for employees)
    const emailToUse = loginEmail.includes('@') ? loginEmail : `${loginEmail.toLowerCase().trim()}@inova.mov`;
    const { error } = await signIn(emailToUse, loginPassword);
    setLoading(false);
    if (error) {
      setError('Usuário ou senha incorretos.');
    } else {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1) Admin → dashboard
        const { data: roleRow } = await supabase
          .from('user_roles').select('role')
          .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        if (roleRow) { navigate('/'); return; }

        // 2) Afiliado → /afiliado
        if (user.email) {
          const { data: affiliateRows } = await supabase
            .from('affiliates')
            .select('id')
            .ilike('email', user.email)
            .limit(1);
          if (affiliateRows && affiliateRows.length > 0) { navigate('/afiliado'); return; }
        }

        // 3) Empresa da Rede de Negócios → feed /negocios
        const { data: companyRow } = await supabase
          .from('rede_companies').select('id')
          .eq('owner_user_id', user.id).maybeSingle();
        if (companyRow) { navigate('/negocios'); return; }

        // 4) Funcionário Inova → minhas tarefas
        navigate('/minhas-tarefas');
      } else {
        navigate('/');
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (signUpPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(signUpEmail, signUpPassword, signUpName);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSignUpSuccess(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="flex items-center justify-center pb-2">
          <img src={logoInova} alt="INOVA Co." className="h-10" />
        </CardHeader>
        <CardContent>
          {signUpSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle className="h-12 w-12 text-[hsl(var(--success))]" />
              <h2 className="text-lg font-semibold text-foreground">Cadastro realizado!</h2>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de verificação para <strong>{signUpEmail}</strong>. Verifique seu email para ativar sua conta.
              </p>
              <Button variant="outline" onClick={() => setSignUpSuccess(false)}>
                Voltar ao login
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail ou usuário</Label>
                    <Input id="login-email" type="text" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="seu@email.com ou marcos" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Input 
                        id="login-password" 
                        type={showLoginPassword ? "text" : "password"} 
                        required 
                        value={loginPassword} 
                        onChange={e => setLoginPassword(e.target.value)} 
                        placeholder="••••••" 
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                  <div className="text-center text-xs text-muted-foreground border-t border-border pt-3 mt-2">
                    É uma empresa da <strong>Rede de Negócios Inova</strong>?<br />
                    Use o login enviado pela equipe Inova para acessar seu perfil e publicar.
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input id="signup-name" required value={signUpName} onChange={e => setSignUpName(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" required value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} placeholder="seu@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input id="signup-password" type="password" required value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Cadastrando...' : 'Cadastrar'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
