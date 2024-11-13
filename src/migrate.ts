import { RoleEnum } from '@prisma/client';
import prisma from './configs/prisma';
import stripe from './configs/stripe';
import { convert } from 'html-to-text';
import { getPlatformFee } from './modules/stripe/stripe.service';
import BigNumber from 'bignumber.js';

type MigrateFunction = () => void;

const migrate = {
  handle: {} as any,

  async start() {
    const ranMigrates = await prisma.migrate.findMany({
      where: {
        name: {
          in: Object.keys(this.handle),
        },
      },
      select: {
        name: true,
      },
    });

    const ran: any = {};

    for (const migrate of ranMigrates) {
      ran[migrate.name] = true;
    }

    for (const name of Object.keys(this.handle)) {
      const handle = this.handle[name];

      if (ran[name]) {
        continue;
      }

      try {
        await handle();

        if (!name.startsWith('_')) {
          await prisma.migrate.create({
            data: {
              name,
            },
          });
        }

        console.log('Run migrate done:', name);
      } catch (error) {
        console.error('Run migrate error:', name, error);
      }
    }
  },

  init() {
    setTimeout(() => {
      this.start().catch((error) => {
        console.error('Migrate init error', error);
      });
    }, 1000);
  },

  add(name: string, handle: MigrateFunction) {
    if (this.handle[name]) {
      console.error(`Migrate ${name} already exists`);
    }

    this.handle[name] = handle;
  },
};

migrate.add('Init', async () => {
  console.log('Init migrate');
});

migrate.add('addRole', async () => {
  const roles = [RoleEnum.ADMIN, RoleEnum.AUTHOR, RoleEnum.USER];
  for (const role of roles) {
    await prisma.role.create({
      data: {
        name: role,
        description: role,
      },
    });
  }
});

migrate.add('html-to-text', async () => {
  const courses = await prisma.course.findMany({ include: { products: true } });
  for (const course of courses) {
    if (course.products.length > 0) {
      for (const product of course.products) {
        await stripe.products.update(product.productStripeId, {
          description: convert(course.descriptionMD),
        });
      }
    }
  }
});

migrate.add('add_cart', async () => {
  const users = await prisma.user.findMany({ include: { cart: true } });
  for (const user of users) {
    if (user.cart.length === 0) {
      await prisma.cart.create({
        data: {
          userId: user.id,
        },
      });
    }
  }
});

migrate.add('add_original_amount', async () => {
  const orders = await prisma.order.findMany({ include: { coursesPaids: { include: { course: true } } } });
  for (const order of orders) {
    if (order.originalAmount) {
      continue;
    }
    const originalAmount = order.coursesPaids.reduce((acc, coursePaid) => {
      return acc + coursePaid.course.priceAmount;
    }, 0);
    const { originalFee } = await getPlatformFee(BigNumber(order.amount));
    await prisma.order.update({
      where: { id: order.id },
      data: {
        originalAmount,
        originalFee: originalFee.toNumber(),
      },
    });
  }
});

export default migrate;
