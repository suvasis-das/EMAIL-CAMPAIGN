import { Router } from 'express';
import multer from 'multer';
import { getLeads, uploadLeads } from '../controllers/leads.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Enforce authentication for all lead management operations
router.use(requireAuth);

// Store uploaded CSV in memory (no temp files to clean up on disk).
// 5 MB is plenty for tens of thousands of leads.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/upload', upload.single('file'), uploadLeads);
router.get('/', getLeads);

export default router;
