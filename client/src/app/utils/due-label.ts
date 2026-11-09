const DAY_MS = 24 * 60 * 60 * 1000;

export const daysUntilDue = (dueDate: string): number => {
  const today = new Date().setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  return Math.round((due - today) / DAY_MS);
};

export const dueLabel = (dueDate: string): string => {
  const days = daysUntilDue(dueDate);

  if (days < 0) {
    return 'Overdue';
  }
  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return 'Due tomorrow';
  }
  return `Due in ${days} days`;
};
