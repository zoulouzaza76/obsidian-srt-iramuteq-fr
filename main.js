"use strict";

const obsidian = require("obsidian");

const NNBSP = "\u202F";
const NBSP = "\u00A0";

function applyFrenchTypography(text) {
  return String(text || "")
    .replace(/\s*([:;?!%])(?=\s|$)/g, NNBSP + "$1")
    .replace(/«\s*/g, "«" + NBSP)
    .replace(/\s*»/g, NBSP + "»")
    .replace(/(\d)\s+€/g, "$1" + NBSP + "€");
}

function parseAndCleanTranscript(raw, options) {
  const keepTimecodes = options && options.keepTimecodes !== false;
  const iramuteqMode = Boolean(options && options.iramuteqMode);
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const turns = [];
  let currentTc = "00:00:00";

  const tcRe = /(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})[.,]\d{1,3}\s*-->/;
  const vttVoiceRe = /^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/i;
  const colonSpeakerRe = /^([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ0-9\s.'()-]{1,42})\s*:\s+(.+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^(?:WEBVTT|NOTE\b|Kind:|Language:)/i.test(line)) continue;
    if (/^\d+$/.test(line) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(line)) continue;

    const tm = line.match(tcRe);
    if (tm) {
      currentTc = tm[1].length === 5 ? "00:" + tm[1] : tm[1];
      continue;
    }

    let speaker = "Intervenant";
    let body = line;
    const vm = line.match(vttVoiceRe);
    const cm = !vm ? line.match(colonSpeakerRe) : null;
    if (vm) {
      speaker = vm[1].trim();
      body = vm[2].trim();
    } else if (cm) {
      speaker = cm[1].trim();
      body = cm[2].trim();
    }

    body = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!body) continue;

    const prev = turns[turns.length - 1];
    if (prev && prev.speaker.toLowerCase() === speaker.toLowerCase()) {
      prev.text = (prev.text + " " + body).replace(/\s+/g, " ").trim();
    } else {
      turns.push({ speaker, tc: currentTc, text: body });
    }
  }

  if (iramuteqMode) {
    const out = ["**** *entretien_obsidian"];
    for (const turn of turns) {
      const token =
        turn.speaker
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || "locuteur";
      out.push("-*loc_" + token);
      out.push(applyFrenchTypography(turn.text.replace(/\*/g, " ")));
    }
    return out.join("\n");
  }

  return turns
    .map((t) => {
      const prefix = keepTimecodes ? `\`[${t.tc}]\` ` : "";
      return `${prefix}**${t.speaker}${NBSP}:** ${applyFrenchTypography(t.text)}`;
    })
    .join("\n\n");
}

class SrtVttCleanerIramuteqPlugin extends obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "clean-srt-vtt-markdown-fr",
      name: "Nettoyer la note .SRT / .VTT en dialogue Markdown (Typographie FR)",
      editorCallback: (editor) => {
        const sel = editor.getSelection();
        const source = sel || editor.getValue();
        const cleaned = parseAndCleanTranscript(source, {
          keepTimecodes: true,
          iramuteqMode: false,
        });
        if (!cleaned) {
          new obsidian.Notice("Aucun segment .SRT / .VTT détecté.");
          return;
        }
        if (sel) {
          editor.replaceSelection(cleaned);
        } else {
          editor.setValue(cleaned);
        }
        new obsidian.Notice("Transcription nettoyée (espaces insécables FR appliquées).");
      },
    });

    this.addCommand({
      id: "convert-note-to-iramuteq-corpus",
      name: "Convertir la transcription en corpus étoilé IRaMuTeQ (**** *entretien)",
      editorCallback: (editor) => {
        const sel = editor.getSelection();
        const source = sel || editor.getValue();
        const corpus = parseAndCleanTranscript(source, {
          keepTimecodes: false,
          iramuteqMode: true,
        });
        if (!corpus) {
          new obsidian.Notice("Aucun segment convertible en corpus IRaMuTeQ.");
          return;
        }
        if (sel) {
          editor.replaceSelection(corpus);
        } else {
          editor.setValue(corpus);
        }
        new obsidian.Notice("Corpus étoilé IRaMuTeQ généré en local.");
      },
    });

    this.addCommand({
      id: "apply-french-typography-note",
      name: "Appliquer les espaces insécables françaises à la sélection / note",
      editorCallback: (editor) => {
        const sel = editor.getSelection();
        if (sel) {
          editor.replaceSelection(applyFrenchTypography(sel));
        } else {
          editor.setValue(applyFrenchTypography(editor.getValue()));
        }
        new obsidian.Notice("Typographie française appliquée.");
      },
    });
  }
}

module.exports = SrtVttCleanerIramuteqPlugin;
