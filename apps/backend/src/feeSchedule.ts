/** Split a fee into whole-rupee installments without changing the schedule total.
 * The first two parts round up; the final part absorbs the remainder. */
export function splitFeeIntoThreeInstallments(total: number): [number, number, number] {
  const totalRupees = Math.ceil(total - Number.EPSILON);
  const firstInstallment = Math.ceil(totalRupees / 3);
  return [firstInstallment, firstInstallment, totalRupees - 2 * firstInstallment];
}

export function createThreeInstallmentSchedule(total: number, admissionYear: number) {
  const amounts = splitFeeIntoThreeInstallments(total);
  return amounts.map((amount, index) => ({
    amount,
    dueDate: new Date(Date.UTC(admissionYear + index, 6, 1))
  }));
}
