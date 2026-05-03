import { usePushNotification, type NotificationSoundType } from '@/hooks/usePushNotification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Bell, Music, Play, Volume2, Sparkles, Smile, PartyPopper } from 'lucide-react';

interface SoundButtonProps {
  title: string;
  description: string;
  soundType: NotificationSoundType;
  icon: React.ReactNode;
  color: string;
}

const sounds: SoundButtonProps[] = [
  {
    title: "Venda! 💰",
    description: "O som preferido da casa",
    soundType: "sale",
    icon: <PartyPopper className="h-6 w-6" />,
    color: "bg-green-500/10 text-green-500 border-green-500/20"
  },
  {
    title: "Agenda 📅",
    description: "O plim amistoso",
    soundType: "agenda",
    icon: <Bell className="h-6 w-6" />,
    color: "bg-primary/10 text-primary border-primary/20"
  },
  {
    title: "Atraso 🚨",
    description: "Alerta de estresse",
    soundType: "overdue",
    icon: <Volume2 className="h-6 w-6" />,
    color: "bg-destructive/10 text-destructive border-destructive/20"
  }
];

export default function NotificationsPage() {
  const { triggerNotification, requestPermission, playSound } = usePushNotification();

  const handlePlaySound = (sound: SoundButtonProps) => {
    playSound(sound.soundType);
    triggerNotification(sound.title, sound.description, "default", sound.soundType);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Notificações</h1>
          <p className="text-sm text-muted-foreground">
            Painel de efeitos sonoros para animar o dia da equipe
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => requestPermission()}
          className="gap-2"
        >
          <Bell className="h-4 w-4" /> Habilitar Notificações
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sounds.map((sound, index) => (
          <motion.div
            key={sound.soundType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card 
              className={`cursor-pointer border-2 transition-all hover:shadow-lg ${sound.color}`}
              onClick={() => handlePlaySound(sound)}
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full bg-background/50`}>
                    {sound.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{sound.title}</h3>
                    <p className="text-sm opacity-80">{sound.description}</p>
                  </div>
                </div>
                <div className="p-2 rounded-full bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-5 w-5 fill-current" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-secondary/30 border-dashed">
        <CardContent className="p-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-background rounded-full flex items-center justify-center text-muted-foreground">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Tem uma sugestão de som?</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Mande o link do MyInstants para o nosso suporte e vamos adicionar aqui para alegrar ainda mais o dia!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
