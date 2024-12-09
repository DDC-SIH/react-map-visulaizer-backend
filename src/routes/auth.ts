// routes/auth.ts
import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '../services/UserService';
import verifyToken from '../middleware/auth';

const router = express.Router();

router.post(
  '/login',
  [
    check('email', 'Email is required').isEmail(),
    check('password', 'Password with 6 or more characters required').isLength({ min: 6 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    const { email, password } = req.body;
    try {
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid Credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid Credentials' });
      }

      const token = jwt.sign(
        { userId: email },
        process.env.JWT_SECRET_KEY as string,
        { expiresIn: '1d' }
      );

      res.status(200).json({ token, userId: email });
    } catch (error) {
      console.error(error);
      res.status(500).send('something went wrong');
    }
  }
);


router.get("/validate-token", verifyToken, (req: Request, res: Response) => {
  const adminEmails = (process.env.ADMIN_EMAIL || '').split(',');
  if (adminEmails.includes(req.userId)) {
    res.status(200).send({ userId: req.userId, isAdmin: true, isAuthorized: req.isAuthorized  });
  } else {
    res.status(200).send({ userId: req.userId, isAdmin: false, isAuthorized: req.isAuthorized  });
  }
});






router.post("/logout", (req: Request, res: Response) => {
  res.cookie("auth_token", "", {
    expires: new Date(0),
  });
  res.send();
});

export default router