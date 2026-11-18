import { Router } from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignStats,
} from '../controllers/campaigns.controller';

const router = Router();

router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id/stats', getCampaignStats);

export default router;
