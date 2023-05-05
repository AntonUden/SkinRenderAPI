import { Request, Response, NextFunction } from 'express';

export function setCorsHeaders(req: Request, res: Response, next: NextFunction): void {
	res.setHeader('Access-Control-Allow-Origin', '*');
	next();
}