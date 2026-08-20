import { Sparkles, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
      <EmptyState
        icon={Sparkles}
        title="Selecione um servidor"
        description="Escolha um servidor na barra lateral ou crie o seu primeiro servidor para começar a conversar."
        action={
          <Button size="lg">
            <Plus className="h-4.5 w-4.5" />
            Criar servidor
          </Button>
        }
      />
    </div>
  );
}
