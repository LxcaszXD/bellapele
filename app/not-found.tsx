import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bp-not-found">
      <img src="/images/logo-bellapelle.png" alt="BellaPelle" />
      <span>404 · Página não encontrada</span>
      <h1>Este caminho não faz parte do seu cuidado.</h1>
      <p>O endereço pode ter mudado. Volte ao site para encontrar procedimentos, equipe e agendamentos.</p>
      <div>
        <Link className="bp-not-found-primary" href="/">Voltar ao início</Link>
        <Link href="/?acesso=login">Acessar minha conta</Link>
      </div>
    </main>
  );
}
