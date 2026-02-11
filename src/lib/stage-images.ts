export const CLIENT_STAGE_IMAGE_STAGES = [
  'cutting',
  'printing',
  'embroidery',
  'sewing',
  'wash_house',
] as const;

export type ClientStageImageStage = (typeof CLIENT_STAGE_IMAGE_STAGES)[number];

const STAGE_IMAGE_CATEGORY_PREFIX = 'stage_image_';

export const STAGE_IMAGE_LABELS: Record<ClientStageImageStage, string> = {
  cutting: 'Cutting',
  printing: 'Printing',
  embroidery: 'Embroidery',
  sewing: 'Sewing',
  wash_house: 'Wash House',
};

export const STAGE_IMAGE_CATEGORIES = CLIENT_STAGE_IMAGE_STAGES.map((stage) =>
  `${STAGE_IMAGE_CATEGORY_PREFIX}${stage}`,
);

export const stageToImageCategory = (stage: ClientStageImageStage) =>
  `${STAGE_IMAGE_CATEGORY_PREFIX}${stage}`;

export const categoryToStage = (
  category: string | null | undefined,
): ClientStageImageStage | null => {
  if (!category) return null;
  const stage = category.replace(STAGE_IMAGE_CATEGORY_PREFIX, '') as ClientStageImageStage;
  return CLIENT_STAGE_IMAGE_STAGES.includes(stage) ? stage : null;
};
