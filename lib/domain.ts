import { z } from "zod";
export const categories = [
  "Todos",
  "Facial",
  "Corporal",
  "Depilação",
  "Tecnologia",
] as const;
export type Treatment = {
  id: number;
  name: string;
  shortName: string;
  category: string;
  description: string;
  about: string;
  duration: number;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  specialistName?: string;
  specialistId?: number;
  experience?: number;
};
export const treatments: Treatment[] = [
  {
    id: 1,
    name: "Hidratação facial premium",
    shortName: "Hidratação facial",
    category: "Facial",
    description: "Limpeza, hidratação e revitalização",
    about:
      "Tratamento completo para limpar, hidratar e devolver o viço natural da pele. Ideal para todos os tipos de pele.",
    duration: 35,
    price: 120,
    rating: 4.9,
    reviews: 142,
    image: "/images/facial-card.jpg",
  },
  {
    id: 2,
    name: "Massagem modeladora",
    shortName: "Massagem modeladora",
    category: "Corporal",
    description: "Técnica para contorno corporal",
    about:
      "Massagem com movimentos firmes e precisos para o cuidado corporal. A especialista avalia suas necessidades antes da sessão.",
    duration: 45,
    price: 150,
    rating: 4.9,
    reviews: 98,
    image: "/images/massagem.jpg",
  },
  {
    id: 3,
    name: "Depilação a laser",
    shortName: "Depilação a laser",
    category: "Depilação",
    description: "Tecnologia segura e confortável",
    about:
      "Cuidado personalizado para redução dos pelos. A área e as condições da pele são avaliadas pela especialista antes do procedimento.",
    duration: 30,
    price: 180,
    rating: 4.9,
    reviews: 86,
    image: "/images/depilacao.jpg",
  },
];
export const slots = ["09:30", "11:00", "14:30", "16:00"];
export type Booking = {
  id: string;
  treatmentId: number;
  date: string;
  time: string;
  payment:
    | "Pix"
    | "Cartão de crédito"
    | "Cartão de débito"
    | "Dinheiro"
    | "Não definido";
  status: "confirmed" | "cancelled" | "completed" | "pending" | "no_show";
  specialistName?: string;
  specialistId?: number;
  paymentStatus?: string;
  price: number;
  duration: number;
};
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function availableDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export function endTime(time: string, duration: number) {
  const [h, m] = time.split(":").map(Number);
  const end = h * 60 + m + duration;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
export function dateLabel(date: string, long = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(".", "");
}
export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export function isPast(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).getTime() <= Date.now();
}
export const bookingSchema = z
  .object({
    treatmentId: z.number().int().min(1).max(4294967295),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (d) =>
          !Number.isNaN(Date.parse(d)) &&
          new Date(d).toISOString().slice(0, 10) === d,
        "Data inválida",
      ),
    time: z.enum(["09:30", "11:00", "14:30", "16:00"]),
    payment: z.enum(["Pix", "Cartão de crédito"]),
  })
  .refine((d) => !isPast(d.date, d.time), "Escolha um horário futuro.")
  .refine(
    (d) => Date.parse(d.date) <= Date.now() + 366 * 86400000,
    "Escolha uma data nos próximos 12 meses.",
  );
