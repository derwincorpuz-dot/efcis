import React from "react";
import EmptyPanel from "@/components/EmptyPanel";
import { Wallet } from "lucide-react";

export default function PaymentsPage() {
  return <EmptyPanel title="Payments" description="Track daily collections, payment history, and outstanding balances per borrower." icon={Wallet} />;
}
