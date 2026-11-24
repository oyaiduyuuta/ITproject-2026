import { Router } from 'express';
import { renderIndex, askQuestion } from './aiController';

const aiRouter = Router();

aiRouter.get('/', renderIndex);
aiRouter.post('/ask', askQuestion);

export default aiRouter;