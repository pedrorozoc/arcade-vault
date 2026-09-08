import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import GamePlayer from "@/components/GamePlayer";
import AsteroidsGame from "@/components/games/AsteroidsGame";

export default async function JugarPage({
  params,
}: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  if (id === "asteroides") return <AsteroidsGame game={game} />;
  return <GamePlayer game={game} />;
}
