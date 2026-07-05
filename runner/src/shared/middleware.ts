import * as yup from 'yup';
import { Request, Response, NextFunction } from 'express';

export const validate = (location: 'query' | 'body' | 'params', schema: yup.ObjectSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const validatedData = await schema.validate(req[location], { abortEarly: false });
      Object.assign(req[location], validatedData);
      next();
    } catch (error: unknown) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).json({ error: error.errors.join(', ') });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
};
