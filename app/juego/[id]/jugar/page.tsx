import { notFound } from "next/navigation";
import { getGame } from "@/lib/games-catalog.server";
import GamePlayer from "@/components/GamePlayer";
import AsteroidsGame from "@/components/games/AsteroidsGame";
import TetrisGame from "@/components/games/TetrisGame";

export default async function JugarPage({
  params,
}: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  if (id === "asteroides") return <AsteroidsGame game={game} />;
  if (id === "tetris") return <TetrisGame game={game} />;
  return <GamePlayer game={game} />;
}
