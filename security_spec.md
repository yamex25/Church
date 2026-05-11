# Security Specification - Church Management System

## Data Invariants
1. A **Prayer Request** must have a `memberId` matching the creator's UID.
2. **Financial Records** created by members must store their own UID.
3. Only users in the `admins` collection have elevated privileges (`isAdmin`).
4. **Member Registry** is only visible and writable by admins.

## The Dirty Dozen Payloads (Rejection Targets)

1. **Identity Spoofing**: Attempt to create a prayer request with `memberId: "NOT_ME"`.
2. **Elevated Privilege Attempt**: Create a user profile with `role: "Admin"`.
3. **Ghost Field Injection**: Add `isVerified: true` to a finance record.
4. **ID Poisoning**: Use a 2KB string as a `memberId`.
5. **PII Leak**: Authenticated user trying to `get` someone else's private finance record.
6. **State Shortcut**: Updating a finance record's `date` after it was recorded.
7. **Resource Exhaustion**: Sending a 10MB string as `requestText`.
8. **Orphaned Write**: Creating a finance record without a valid type.
9. **Private Breach**: Listing someone else's `isPrivate: true` prayer requests.
10. **Admin Bypass**: Attempting to delete a member as a standard member.
11. **Verification Spoofing**: Writing as a user with `email_verified: false` (when required).
12. **System Field Overwrite**: Changing `recordedBy` on an existing finance record.

## Test Results
All payloads return `PERMISSION_DENIED` under the current `firestore.rules`.
