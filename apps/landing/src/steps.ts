/** Landing page content model. Keep every claim true of the app today:
 * no testimonials, no benchmarks, no store-coverage promises. */
export interface Step {
  title: string;
  body: string;
}

export const steps: Step[] = [
  {
    title: 'Point at a price',
    body: 'Hold your phone over a shelf tag. Tally reads the price — or guides you to the barcode when the tag will not scan.',
  },
  {
    title: 'Watch your total',
    body: 'Every item joins your basket. Your running spend stays pinned on screen against the budget you set.',
  },
  {
    title: 'No surprises at the register',
    body: 'Totals are predicted, never promised: each price carries its source and confidence, with an honest range. Register total may differ.',
  },
];
