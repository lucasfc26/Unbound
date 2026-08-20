import { Link, Navigate } from "react-router-dom";
import {
  Download,
  MessageSquare,
  Mic,
  MonitorUp,
  ShieldCheck,
  Apple,
  Laptop,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { PUBLIC_ORIGIN } from "@/lib/api";

// Served from the backend's persistent uploads volume, not bundled into the
// frontend image — a gitignored local build artifact never reliably makes
// it into a Docker build context, which is what silently turned this into
// index.html served with a .exe filename before.
const DOWNLOAD_URL = `${PUBLIC_ORIGIN}/uploads/releases/Unbound-Setup.exe`;
const APP_VERSION = "0.1.0";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Mensagens em tempo real",
    description:
      "Canais de texto por servidor, histórico completo e indicador de digitação — sem atraso perceptível.",
  },
  {
    icon: Mic,
    title: "Salas de voz cristalinas",
    description:
      "Conexão direta entre participantes (P2P), com detecção de fala e controle individual de volume.",
  },
  {
    icon: MonitorUp,
    title: "Compartilhamento de tela sob demanda",
    description:
      "Transmissão via SFU dedicado: você só recebe o vídeo de quem está realmente assistindo naquele momento.",
  },
  {
    icon: ShieldCheck,
    title: "100% self-hosted",
    description:
      "Seus dados ficam no seu servidor. Sem anúncios, sem terceiros, sem depender de ninguém além de você.",
  },
];

export default function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/app" replace />;

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-bg-primary text-text-primary">
      <BackgroundGlow />

      <div className="relative z-10">
        <Nav />
        <Hero />
        <Features />
        <DownloadSection />
        <Footer />
      </div>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[-10%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent/25 blur-[120px]" />
      <div className="absolute right-[-10%] top-[30%] h-[28rem] w-[28rem] rounded-full bg-[#3dc77a]/10 blur-[130px]" />
      <div className="absolute bottom-[-15%] left-[-10%] h-[30rem] w-[30rem] rounded-full bg-[#5a7dff]/10 blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(var(--color-text-primary)) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
}

function Logomark({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-xl bg-black shadow-lg shadow-black/40 ${className ?? "h-9 w-9"}`}
    >
      <img src="/favicon.png" alt="" className="h-full w-full object-cover" />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-bg-primary/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <Logomark />
          <span className="text-subheading text-text-primary">Unbound</span>
        </div>

        <nav className="hidden items-center gap-8 text-small text-text-secondary sm:flex">
          <a href="#recursos" className="transition-colors hover:text-text-primary">
            Recursos
          </a>
          <a href="#download" className="transition-colors hover:text-text-primary">
            Download
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-small font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Entrar
          </Link>
          <a
            href={DOWNLOAD_URL}
            download
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-small font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-accent/40"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-20 text-center sm:pt-28">
      <span
        className="animate-fade-in rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-caption text-text-secondary backdrop-blur-sm"
        style={{ animationDelay: "0ms" }}
      >
        Privado. Seu. Sem intermediários.
      </span>

      <h1
        className="animate-slide-up mt-6 text-5xl font-bold tracking-tight text-text-primary sm:text-6xl md:text-7xl"
        style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
      >
        Sua comunidade,
        <br />
        <span className="bg-gradient-to-r from-accent via-[#a78bff] to-[#5a7dff] bg-clip-text text-transparent">
          do seu jeito.
        </span>
      </h1>

      <p
        className="animate-slide-up mt-6 max-w-xl text-body text-text-secondary sm:text-subheading"
        style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
      >
        Chat, voz e compartilhamento de tela em um único lugar — rodando no
        seu próprio servidor, sem anúncios e sem alguém lendo suas mensagens.
      </p>

      <div
        className="animate-slide-up mt-9 flex flex-col items-center gap-3 sm:flex-row"
        style={{ animationDelay: "180ms", animationFillMode: "backwards" }}
      >
        <a
          href={DOWNLOAD_URL}
          download
          className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-body font-semibold text-white shadow-xl shadow-accent/30 transition-all hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-accent/50"
        >
          <Laptop className="h-4 w-4" />
          Baixar para Windows
        </a>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-body font-medium text-text-primary backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]"
        >
          Entrar no navegador
        </Link>
      </div>

      <span
        className="animate-fade-in mt-4 text-caption text-text-muted"
        style={{ animationDelay: "220ms", animationFillMode: "backwards" }}
      >
        Windows · 64-bit · v{APP_VERSION} · 2,1 MB
      </span>

      <HeroPreview />
    </section>
  );
}

/** Stylized, decorative stand-in for a product screenshot — abstract chat + voice layout. */
function HeroPreview() {
  return (
    <div
      className="animate-slide-up relative mt-16 w-full max-w-3xl"
      style={{ animationDelay: "280ms", animationFillMode: "backwards" }}
    >
      <div className="absolute inset-x-8 -bottom-6 h-16 rounded-[2rem] bg-accent/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/50 backdrop-blur-2xl">
        <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        <div className="flex h-64 sm:h-80">
          <div className="hidden w-40 shrink-0 flex-col gap-3 border-r border-white/5 bg-white/[0.02] p-4 sm:flex">
            <div className="h-2 w-16 rounded-full bg-white/10" />
            {[70, 55, 85, 45].map((w, i) => (
              <div
                key={i}
                className="h-6 rounded-lg bg-white/[0.04]"
                style={{ width: `${w}%` }}
              />
            ))}
            <div className="mt-2 h-2 w-20 rounded-full bg-white/10" />
            <div className="flex items-center gap-2 rounded-lg bg-accent/15 px-2 py-1.5">
              <span className="h-5 w-5 shrink-0 rounded-full bg-accent/50" />
              <div className="h-2 w-14 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="h-5 w-5 shrink-0 rounded-full bg-white/10" />
              <div className="h-2 w-10 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[#5a7dff]/40" />
              <div className="flex flex-col gap-1.5">
                <div className="h-2 w-16 rounded-full bg-white/15" />
                <div className="h-3 w-48 rounded-lg bg-white/[0.06]" />
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-accent/40" />
              <div className="flex flex-col gap-1.5">
                <div className="h-2 w-20 rounded-full bg-white/15" />
                <div className="h-3 w-36 rounded-lg bg-white/[0.06]" />
                <div className="h-3 w-56 rounded-lg bg-white/[0.06]" />
              </div>
            </div>
            <div className="mt-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <div className="h-2 flex-1 rounded-full bg-white/10" />
              <span className="h-6 w-6 rounded-full bg-accent/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Feito para quem gosta de ter controle
        </h2>
        <p className="mt-3 text-body text-text-secondary">
          Cada detalhe pensado para funcionar bem em um grupo pequeno — sem o
          peso de uma plataforma feita para milhões de usuários.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent transition-colors group-hover:bg-accent/25">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-subheading text-text-primary">{title}</h3>
            <p className="mt-1.5 text-small leading-relaxed text-text-secondary">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DownloadSection() {
  return (
    <section id="download" className="mx-auto max-w-5xl px-6 py-20">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8 text-center backdrop-blur-2xl sm:p-14">
        <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Leve o Unbound com você
        </h2>
        <p className="mx-auto mt-3 max-w-md text-body text-text-secondary">
          Aplicativo nativo, mais leve e com notificações do sistema. Ou
          entre direto pelo navegador — sem instalar nada.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PlatformCard
            icon={<Laptop className="h-6 w-6" />}
            name="Windows"
            detail={`v${APP_VERSION} · 2,1 MB`}
            href={DOWNLOAD_URL}
            available
          />
          <PlatformCard
            icon={<Apple className="h-6 w-6" />}
            name="macOS"
            detail="Em breve"
          />
          <PlatformCard
            icon={<Laptop className="h-6 w-6" />}
            name="Linux"
            detail="Em breve"
          />
        </div>
      </div>
    </section>
  );
}

function PlatformCard({
  icon,
  name,
  detail,
  href,
  available,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  href?: string;
  available?: boolean;
}) {
  const content = (
    <>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          available
            ? "bg-accent/20 text-accent"
            : "bg-white/5 text-text-muted"
        }`}
      >
        {icon}
      </div>
      <span className="mt-3 text-body font-semibold text-text-primary">
        {name}
      </span>
      <span className="mt-0.5 text-caption text-text-muted">{detail}</span>
    </>
  );

  const baseClasses =
    "flex flex-col items-center rounded-2xl border px-5 py-6 transition-all";

  if (available && href) {
    return (
      <a
        href={href}
        download
        className={`${baseClasses} border-white/10 bg-white/[0.04] hover:-translate-y-1 hover:border-accent/40 hover:bg-white/[0.07]`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`${baseClasses} cursor-not-allowed border-white/5 bg-white/[0.02] opacity-60`}
    >
      {content}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-caption text-text-muted sm:flex-row">
        <div className="flex items-center gap-2">
          <Logomark className="h-6 w-6" />
          <span>Unbound — self-hosted, sempre.</span>
        </div>
        <Link to="/login" className="transition-colors hover:text-text-secondary">
          Já tem uma conta? Entrar
        </Link>
      </div>
    </footer>
  );
}
