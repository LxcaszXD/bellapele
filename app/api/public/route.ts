import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const publicImage = (value: unknown) => {
  if (typeof value !== "string" || value.length > 500) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

export async function GET() {
  try {
    const pool = db();
    const [procedures] = await pool.execute<RowDataPacket[]>(
      `SELECT p.id_procedimento, p.nome, p.categoria, p.duracao_minutos, p.valor_avulso,
              p.descricao, p.imagem_url, pr.id_profissional,
              pr.nome AS profissional, pr.especialidade AS profissional_especialidade
         FROM Procedimento p
         LEFT JOIN AgendaConfiguracao cfg ON cfg.id_procedimento=p.id_procedimento
         LEFT JOIN Profissional pr ON pr.id_profissional=cfg.id_profissional AND pr.ativo=1
        WHERE p.ativo=1
        ORDER BY p.categoria, p.nome`,
    );
    const [professionals] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT pr.id_profissional, pr.nome, pr.especialidade,
              pr.foto_url, pr.anos_experiencia
         FROM Profissional pr
         JOIN ProfissionalProcedimento pp
           ON pp.id_profissional=pr.id_profissional AND pp.ativo=1
         JOIN Procedimento p
           ON p.id_procedimento=pp.id_procedimento AND p.ativo=1
         ORDER BY pr.nome`,
    );
    const [reviews] = await pool.execute<RowDataPacket[]>(
      `SELECT av.id_avaliacao, av.nota, av.comentario, av.data_avaliacao,
              p.nome AS procedimento,
              CONCAT(SUBSTRING_INDEX(c.nome_completo,' ',1), ' ',
                     LEFT(SUBSTRING_INDEX(c.nome_completo,' ',-1),1), '.') AS cliente
         FROM Avaliacao av
         JOIN Agendamento a ON a.id_agendamento=av.id_agendamento
         JOIN Cliente c ON c.id_cliente=a.id_cliente
         JOIN Procedimento p ON p.id_procedimento=a.id_procedimento
        WHERE av.publicada=1 AND av.consentimento_publicacao=1 AND av.comentario IS NOT NULL
          AND TRIM(av.comentario)<>''
        ORDER BY av.data_avaliacao DESC
        LIMIT 12`,
    );
    const [posts] = await pool.execute<RowDataPacket[]>(
      `SELECT id_post, titulo, resumo, conteudo, imagem_url, data_publicacao
         FROM BlogPost
        WHERE publicado=1 AND (data_publicacao IS NULL OR data_publicacao<=UTC_TIMESTAMP())
        ORDER BY COALESCE(data_publicacao,criado_em) DESC, id_post DESC
        LIMIT 6`,
    );
    const [configuration] = await pool.execute<RowDataPacket[]>(
      `SELECT telefone, whatsapp, email, endereco, horario_atendimento, cnpj,
              politica_privacidade FROM ConfiguracaoPublica WHERE id=1 LIMIT 1`,
    );
    const settings = configuration[0];
    return Response.json(
      {
        contact: settings
          ? {
              phone: settings.telefone || "",
              whatsapp: settings.whatsapp || "",
              email: settings.email || "",
              address: settings.endereco || "",
              hours: settings.horario_atendimento || "",
              cnpj: settings.cnpj || "",
              privacyPolicy: settings.politica_privacidade || "",
            }
          : null,
        procedures: procedures.map((p) => ({
          id: Number(p.id_procedimento),
          name: p.nome,
          category: p.categoria,
          duration: Number(p.duracao_minutos),
          price: Number(p.valor_avulso),
          description: p.descricao || "",
          image: publicImage(p.imagem_url),
          professional: p.id_profissional
            ? {
                id: Number(p.id_profissional),
                name: p.profissional,
                specialty: p.profissional_especialidade,
              }
            : null,
        })),
        professionals: professionals.map((p) => ({
          id: Number(p.id_profissional),
          name: p.nome,
          specialty: p.especialidade,
          image: publicImage(p.foto_url),
          experience: Number(p.anos_experiencia || 0),
        })),
        reviews: reviews.map((r) => ({
          id: Number(r.id_avaliacao),
          rating: Number(r.nota),
          comment: r.comentario,
          date: r.data_avaliacao,
          procedure: r.procedimento,
          customer: r.cliente,
        })),
        posts: posts.map((p) => ({
          id: Number(p.id_post),
          title: p.titulo,
          summary: p.resumo,
          content: p.conteudo,
          image: publicImage(p.imagem_url),
          date: p.data_publicacao,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Conteúdo temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
