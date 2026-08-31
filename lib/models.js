export const DEFAULT_MODEL = "h3";

export const MODELS = {
  h3: {
    id: "minimax/h3/text-to-video",
    label: "H3",
    kind: "t2v",
    input(prompt) {
      return {
        prompt,
        duration: 5,
        resolution: "768P",
        aspect_ratio: "9:16",
        prompt_expansion_mode: "fast",
      };
    },
  },
  ltx: {
    id: "fal-ai/ltx-2.3/text-to-video/fast",
    label: "LTX Fast",
    kind: "t2v",
    garnish: true,
    input(prompt) {
      return {
        prompt,
        duration: 6,
        resolution: "1080p",
        aspect_ratio: "9:16",
        fps: 25,
        generate_audio: true,
      };
    },
  },
  flux: {
    id: "fal-ai/flux/schnell",
    label: "Flux Schnell",
    kind: "t2i",
    input(prompt) {
      return {
        prompt,
        image_size: { width: 768, height: 1344 },
        num_inference_steps: 4,
        output_format: "jpeg",
        acceleration: "high",
      };
    },
  },
};

export function getModel(name = DEFAULT_MODEL) {
  const model = MODELS[name] || MODELS[DEFAULT_MODEL];
  if (!model) throw new Error(`unknown model: ${name}`);
  return model;
}
