import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export async function requireOrganizationMember(user: DecodedIdToken, organizationId: string) {
  const { firestore } = getFirebaseAdmin();
  const membership = await firestore
    .collection("organizations")
    .doc(organizationId)
    .collection("members")
    .doc(user.uid)
    .get();
  if (!membership.exists) return null;
  return membership.data() as { uid: string; role: "owner" | "admin" | "member" };
}
