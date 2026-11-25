import { Router } from 'express';
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
} from '../controllers/templates.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Enforce authentication for all template operations
router.use(requireAuth);

router.post('/', createTemplate);
router.get('/', getTemplates);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
