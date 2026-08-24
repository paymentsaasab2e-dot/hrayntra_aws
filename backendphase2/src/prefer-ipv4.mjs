/**
 * Prefer IPv4 DNS results before IPv6.
 * Corporate / NAT64 resolvers often return broken `64:ff9b::…` AAAA records
 * for MongoDB Atlas hosts, which surfaces as:
 *   - No such host is known (os error 11001)
 *   - ReplicaSetNoPrimary / Server selection timeout
 *   - getaddrinfo ENOTFOUND …mongodb.net
 */
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* Node < 17 */
}
