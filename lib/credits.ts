import { db } from "@/lib/db";

export const CREDIT_COSTS = {
  static_ad: 5,
  video_ad: 20,
  ugc_video: 25,
  script: 2,
  competitor_research: 3,
  campaign: 50,
} as const;

export type GenerationType = keyof typeof CREDIT_COSTS;

export async function getCredits(orgId: string): Promise<number> {
  const { data } = await db
    .from("credit_balances")
    .select("balance")
    .eq("org_id", orgId)
    .single();

  return data?.balance ?? 0;
}

export async function deductCredits(
  orgId: string,
  type: GenerationType,
  description: string
): Promise<{ success: boolean; balance: number }> {
  const cost = CREDIT_COSTS[type];
  const currentBalance = await getCredits(orgId);

  if (currentBalance < cost) {
    return { success: false, balance: currentBalance };
  }

  const newBalance = currentBalance - cost;

  await db
    .from("credit_balances")
    .update({ balance: newBalance })
    .eq("org_id", orgId);

  await db.from("credit_transactions").insert({
    org_id: orgId,
    amount: -cost,
    type: "deduction",
    description,
    balance_after: newBalance,
  });

  return { success: true, balance: newBalance };
}

export async function addCredits(
  orgId: string,
  amount: number,
  description: string
): Promise<number> {
  const currentBalance = await getCredits(orgId);
  const newBalance = currentBalance + amount;

  await db
    .from("credit_balances")
    .update({ balance: newBalance })
    .eq("org_id", orgId);

  await db.from("credit_transactions").insert({
    org_id: orgId,
    amount,
    type: "purchase",
    description,
    balance_after: newBalance,
  });

  return newBalance;
}
