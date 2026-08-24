/**
 * The desktop line-item column template, shared by the header row in
 * CategoryTable and the data rows in LineItemRow. It lives in its own module
 * because CategoryTable already imports LineItemRow — importing back would be a
 * cycle — and because the two drifting apart is exactly how the header stops
 * lining up with the rows.
 *
 * Columns: name · projected · actual · currency · diff · paid · due · delete
 */
export const ROW_GRID = '1.4fr 76px 76px 58px 76px 104px 104px 24px';
