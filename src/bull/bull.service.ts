export const scheduleJob = (
  queueName: string,
  runAt: Date,
  data: { id: string },
) => {
  const queue = queues[queueName];
  const now = new Date();
  const delay = runAt.getTime() - now.getTime();

  queue.add(data, { delay });
};

export const queues = {};
