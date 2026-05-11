// Director persona loader.
//
// All 20 personas are stored as JSON files in ./personas/. This module loads
// them at import time (server-side only — these are read once, then cached).
// Used by the lobby UI to present the gallery and by the agent loop to inject
// the chosen director's persona into the system prompt.

import type { DirectorPersona } from "./types";

import marcelVrai from "./personas/marcel-vrai.json";
import yukiSato from "./personas/yuki-sato.json";
import svenHolmgren from "./personas/sven-holmgren.json";
import ottoKessler from "./personas/otto-kessler.json";
import henrikAalto from "./personas/henrik-aalto.json";
import edgarLoomis from "./personas/edgar-loomis.json";
import damienRoux from "./personas/damien-roux.json";
import aleksandraVolkov from "./personas/aleksandra-volkov.json";
import nadiaCamillo from "./personas/nadia-camillo.json";
import kaitoMori from "./personas/kaito-mori.json";
import meiChen from "./personas/mei-chen.json";
import tomasVela from "./personas/tomas-vela.json";
import catarinaReis from "./personas/catarina-reis.json";
import rajBhattacharya from "./personas/raj-bhattacharya.json";
import ingeBrandt from "./personas/inge-brandt.json";
import paulineTessier from "./personas/pauline-tessier.json";
import brunoSalgado from "./personas/bruno-salgado.json";
import ezraStein from "./personas/ezra-stein.json";
import zaraOkafor from "./personas/zara-okafor.json";
import felixMarchetti from "./personas/felix-marchetti.json";

const ALL_PERSONAS: DirectorPersona[] = [
  marcelVrai,
  yukiSato,
  svenHolmgren,
  ottoKessler,
  henrikAalto,
  edgarLoomis,
  damienRoux,
  aleksandraVolkov,
  nadiaCamillo,
  kaitoMori,
  meiChen,
  tomasVela,
  catarinaReis,
  rajBhattacharya,
  ingeBrandt,
  paulineTessier,
  brunoSalgado,
  ezraStein,
  zaraOkafor,
  felixMarchetti,
] as DirectorPersona[];

const PERSONA_BY_ID: Record<string, DirectorPersona> = Object.fromEntries(
  ALL_PERSONAS.map((p) => [p.id, p])
);

export function getAllPersonas(): DirectorPersona[] {
  return ALL_PERSONAS;
}

export function getPersonaById(id: string): DirectorPersona | undefined {
  return PERSONA_BY_ID[id];
}

/**
 * Lobby-safe view — strips the inspiration field (PRIVATE per persona schema)
 * so the client doesn't see who the persona is "really" inspired by. The
 * curriculum stays implicit through filmsCited.
 */
export type LobbyDirector = Omit<DirectorPersona, "inspiration" | "personality" | "startScript">;

export function getLobbyDirectors(): LobbyDirector[] {
  return ALL_PERSONAS.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inspiration, personality, startScript, ...rest } = p;
    return rest;
  });
}

export type { DirectorPersona } from "./types";
