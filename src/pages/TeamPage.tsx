import { useAgency } from '@/contexts/AgencyContext';
import { Mail, Info, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function TeamPage() {
  const { team, tasks } = useAgency();
  const navigate = useNavigate();

  const getTaskCount = (name: string) =>
    tasks.filter(t => t.assignee === name && t.status !== 'Concluído').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-heading font-semibold text-foreground">Equipe</h1>
          <p className="text-body text-muted-foreground">{team.length} membros ativos</p>
        </div>
        <Button onClick={() => navigate('/funcionarios')} className="gap-2">
          <UserCog className="h-4 w-4" /> Gerenciar Funcionários
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-caption text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <p>
          A lista abaixo reflete os funcionários cadastrados. Para adicionar, editar ou desativar membros, vá em{' '}
          <button onClick={() => navigate('/funcionarios')} className="text-primary underline-offset-2 hover:underline">
            Funcionários
          </button>.
        </p>
      </div>

      {team.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-body text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/funcionarios')}>
            Cadastrar primeiro funcionário
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-shadow rounded-lg bg-card p-5 transition-default"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-body font-semibold text-primary">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-body font-medium text-foreground truncate">{member.name}</p>
                  <p className="text-caption text-muted-foreground truncate">{member.role || 'Sem cargo'}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-caption text-muted-foreground min-w-0">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
                <Badge variant={member.permissions === 'Admin' ? 'default' : 'secondary'} className="text-[10px]">
                  {member.permissions}
                </Badge>
              </div>
              <div className="mt-2 text-caption text-muted-foreground">
                {getTaskCount(member.name)} tarefas pendentes
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
