import { Router } from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignStats,
} from '../controllers/campaigns.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Enforce authentication for all campaign operations and telemetry
router.use(requireAuth);

router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id/stats', getCampaignStats);

export default router;
