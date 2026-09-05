import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import GamePlayer from "@/components/GamePlayer";

export default async function JugarPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
