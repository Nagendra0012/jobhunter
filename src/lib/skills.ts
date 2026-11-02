// Skill taxonomy for security engineering roles. Each skill has a canonical
// name and the aliases it shows up as in resumes and job descriptions.

export type SkillCategory =
  | "Cloud Platforms"
  | "Cloud Security"
  | "Identity & Access"
  | "Detection & Response"
  | "Offensive & AppSec"
  | "Network Security"
  | "Infrastructure & DevOps"
  | "Programming & Scripting"
  | "Frameworks & Compliance"
  | "Security Tools"
  | "Soft Skills";

export type Skill = {
  name: string;
  category: SkillCategory;
  aliases: string[];
};

export type Cert = {
  name: string;
  aliases: string[];
};

const S = (category: SkillCategory, name: string, ...aliases: string[]): Skill => ({
  name,
  category,
  aliases: [name, ...aliases],
});

export const SKILLS: Skill[] = [
  // Cloud platforms
  S("Cloud Platforms", "AWS", "Amazon Web Services"),
  S("Cloud Platforms", "Azure", "Microsoft Azure"),
  S("Cloud Platforms", "GCP", "Google Cloud", "Google Cloud Platform"),
  S("Cloud Platforms", "Oracle Cloud", "OCI"),
  S("Cloud Platforms", "Multi-cloud", "multicloud", "hybrid cloud"),

  // Cloud security
  S("Cloud Security", "CSPM", "cloud security posture management"),
  S("Cloud Security", "CNAPP", "cloud native application protection"),
  S("Cloud Security", "CWPP", "cloud workload protection"),
  S("Cloud Security", "AWS Security Hub", "Security Hub"),
  S("Cloud Security", "GuardDuty", "Amazon GuardDuty"),
  S("Cloud Security", "AWS Config"),
  S("Cloud Security", "CloudTrail", "AWS CloudTrail"),
  S("Cloud Security", "AWS KMS", "KMS", "key management service"),
  S("Cloud Security", "AWS Organizations", "SCP", "SCPs", "service control policies"),
  S("Cloud Security", "Microsoft Defender for Cloud", "Defender for Cloud", "Azure Security Center"),
  S("Cloud Security", "Azure Policy"),
  S("Cloud Security", "Azure Key Vault", "Key Vault"),
  S("Cloud Security", "GCP Security Command Center", "Security Command Center"),
  S("Cloud Security", "Wiz"),
  S("Cloud Security", "Prisma Cloud"),
  S("Cloud Security", "Orca Security", "Orca"),
  S("Cloud Security", "Lacework"),
  S("Cloud Security", "Container Security", "container security", "image scanning"),
  S("Cloud Security", "Kubernetes Security", "kubernetes security", "pod security", "RBAC for Kubernetes"),
  S("Cloud Security", "Serverless Security", "lambda security"),
  S("Cloud Security", "Encryption", "encryption at rest", "encryption in transit", "cryptography", "TLS", "PKI"),
  S("Cloud Security", "Secrets Management", "HashiCorp Vault", "Secrets Manager", "secrets management"),
  S("Cloud Security", "Data Loss Prevention", "DLP"),

  // Identity & access
  S("Identity & Access", "IAM", "identity and access management", "AWS IAM", "Azure IAM"),
  S("Identity & Access", "Entra ID", "Azure AD", "Azure Active Directory", "Microsoft Entra"),
  S("Identity & Access", "Active Directory", "AD DS", "Group Policy", "GPO"),
  S("Identity & Access", "Okta"),
  S("Identity & Access", "SSO", "single sign-on", "single sign on"),
  S("Identity & Access", "SAML"),
  S("Identity & Access", "OAuth", "OAuth2", "OAuth 2.0", "OIDC", "OpenID Connect"),
  S("Identity & Access", "MFA", "multi-factor authentication", "2FA"),
  S("Identity & Access", "PAM", "privileged access management", "CyberArk", "BeyondTrust"),
  S("Identity & Access", "Zero Trust", "zero-trust", "ZTNA"),
  S("Identity & Access", "Least Privilege", "least-privilege"),

  // Detection & response
  S("Detection & Response", "SIEM"),
  S("Detection & Response", "Splunk", "SPL"),
  S("Detection & Response", "Microsoft Sentinel", "Azure Sentinel", "Sentinel", "KQL"),
  S("Detection & Response", "Elastic Security", "ELK", "Elasticsearch", "Kibana"),
  S("Detection & Response", "QRadar", "IBM QRadar"),
  S("Detection & Response", "Chronicle", "Google SecOps"),
  S("Detection & Response", "SOAR", "Cortex XSOAR", "Splunk SOAR", "Phantom", "Tines"),
  S("Detection & Response", "EDR", "XDR", "endpoint detection"),
  S("Detection & Response", "CrowdStrike", "Falcon"),
  S("Detection & Response", "Microsoft Defender for Endpoint", "Defender for Endpoint", "MDE"),
  S("Detection & Response", "SentinelOne"),
  S("Detection & Response", "Incident Response", "incident response", "incident handling", "IR"),
  S("Detection & Response", "Threat Hunting", "threat hunting"),
  S("Detection & Response", "Threat Intelligence", "threat intel", "CTI"),
  S("Detection & Response", "Detection Engineering", "detection engineering", "detection rules", "Sigma"),
  S("Detection & Response", "Digital Forensics", "forensics", "DFIR"),
  S("Detection & Response", "Log Analysis", "log analysis", "log management"),
  S("Detection & Response", "SOC", "security operations center", "security operations"),
  S("Detection & Response", "Malware Analysis", "malware analysis", "reverse engineering"),

  // Offensive & application security
  S("Offensive & AppSec", "Penetration Testing", "penetration testing", "pentesting", "pen testing", "pentest"),
  S("Offensive & AppSec", "Vulnerability Management", "vulnerability management", "vulnerability assessment", "vuln management"),
  S("Offensive & AppSec", "Threat Modeling", "threat modeling", "threat modelling", "STRIDE"),
  S("Offensive & AppSec", "Application Security", "application security", "AppSec", "secure code review", "secure coding"),
  S("Offensive & AppSec", "SAST", "static analysis", "Semgrep", "Checkmarx", "SonarQube", "CodeQL"),
  S("Offensive & AppSec", "DAST", "dynamic analysis"),
  S("Offensive & AppSec", "SCA", "software composition analysis", "Snyk", "Dependabot"),
  S("Offensive & AppSec", "OWASP", "OWASP Top 10"),
  S("Offensive & AppSec", "API Security", "API security"),
  S("Offensive & AppSec", "Red Team", "red teaming", "red team"),
  S("Offensive & AppSec", "Purple Team", "purple teaming"),
  S("Offensive & AppSec", "MITRE ATT&CK", "ATT&CK", "MITRE ATTACK"),

  // Network security
  S("Network Security", "Firewalls", "firewall", "NGFW", "Palo Alto", "Fortinet", "FortiGate", "Check Point"),
  S("Network Security", "IDS/IPS", "IDS", "IPS", "Snort", "Suricata", "Zeek"),
  S("Network Security", "VPN", "IPsec", "WireGuard"),
  S("Network Security", "WAF", "web application firewall", "Cloudflare", "AWS WAF"),
  S("Network Security", "TCP/IP", "networking", "DNS", "BGP", "subnetting"),
  S("Network Security", "VPC", "VNet", "security groups", "network segmentation", "microsegmentation"),
  S("Network Security", "Wireshark", "packet analysis", "tcpdump"),
  S("Network Security", "Nmap"),
  S("Network Security", "Burp Suite", "Burp"),
  S("Network Security", "Metasploit"),
  S("Network Security", "Nessus", "Tenable", "Qualys", "Rapid7", "InsightVM"),

  // Infrastructure & DevOps
  S("Infrastructure & DevOps", "Terraform", "HCL"),
  S("Infrastructure & DevOps", "CloudFormation", "AWS CloudFormation"),
  S("Infrastructure & DevOps", "Infrastructure as Code", "IaC", "infrastructure-as-code"),
  S("Infrastructure & DevOps", "Kubernetes", "K8s", "EKS", "AKS", "GKE"),
  S("Infrastructure & DevOps", "Docker", "containers", "containerization"),
  S("Infrastructure & DevOps", "CI/CD", "CI / CD", "continuous integration", "GitHub Actions", "GitLab CI", "Jenkins", "Azure DevOps"),
  S("Infrastructure & DevOps", "DevSecOps", "DevSecOps", "shift left", "shift-left"),
  S("Infrastructure & DevOps", "Linux", "RHEL", "Ubuntu", "CentOS"),
  S("Infrastructure & DevOps", "Windows Server"),
  S("Infrastructure & DevOps", "Ansible"),
  S("Infrastructure & DevOps", "Git", "GitHub", "GitLab"),
  S("Infrastructure & DevOps", "Policy as Code", "OPA", "Open Policy Agent", "Rego", "Sentinel policies", "Checkov", "tfsec"),

  // Programming & scripting
  S("Programming & Scripting", "Python"),
  S("Programming & Scripting", "PowerShell"),
  S("Programming & Scripting", "Bash", "shell scripting"),
  S("Programming & Scripting", "Go", "Golang"),
  S("Programming & Scripting", "Java"),
  S("Programming & Scripting", "JavaScript", "TypeScript", "Node.js"),
  S("Programming & Scripting", "C/C++", "C++"),
  S("Programming & Scripting", "SQL"),
  S("Programming & Scripting", "REST APIs", "REST API", "RESTful"),
  S("Programming & Scripting", "Automation", "security automation", "scripting"),

  // Frameworks & compliance
  S("Frameworks & Compliance", "NIST", "NIST CSF", "NIST 800-53", "NIST 800-171"),
  S("Frameworks & Compliance", "ISO 27001", "ISO/IEC 27001", "ISO27001"),
  S("Frameworks & Compliance", "SOC 2", "SOC2", "SOC II"),
  S("Frameworks & Compliance", "PCI DSS", "PCI-DSS", "PCI"),
  S("Frameworks & Compliance", "HIPAA"),
  S("Frameworks & Compliance", "FedRAMP"),
  S("Frameworks & Compliance", "CIS Benchmarks", "CIS benchmark", "CIS Controls"),
  S("Frameworks & Compliance", "GDPR"),
  S("Frameworks & Compliance", "CMMC"),
  S("Frameworks & Compliance", "Risk Assessment", "risk assessment", "risk management", "GRC"),
  S("Frameworks & Compliance", "Security Architecture", "security architecture", "secure architecture", "architecture review"),
  S("Frameworks & Compliance", "Audit", "audits", "auditing", "compliance"),

  // Tools not covered above
  S("Security Tools", "Jira", "JIRA"),
  S("Security Tools", "ServiceNow"),
  S("Security Tools", "Kali Linux", "Kali"),
  S("Security Tools", "Trivy", "Aqua", "Twistlock", "Falco"),

  // Soft skills
  S("Soft Skills", "Communication", "communication skills", "stakeholder"),
  S("Soft Skills", "Leadership", "mentoring", "mentored", "led a team"),
  S("Soft Skills", "Documentation", "runbooks", "playbooks", "technical writing"),
  S("Soft Skills", "Cross-functional Collaboration", "cross-functional", "collaborated"),
];

export const CERTS: Cert[] = [
  { name: "CISSP", aliases: ["CISSP", "Certified Information Systems Security Professional"] },
  { name: "CCSP", aliases: ["CCSP", "Certified Cloud Security Professional"] },
  { name: "CISM", aliases: ["CISM", "Certified Information Security Manager"] },
  { name: "CISA", aliases: ["CISA", "Certified Information Systems Auditor"] },
  { name: "Security+", aliases: ["Security+", "Security Plus", "CompTIA Security"] },
  { name: "CySA+", aliases: ["CySA+", "CySA", "Cybersecurity Analyst"] },
  { name: "CASP+", aliases: ["CASP+", "CASP", "SecurityX"] },
  { name: "Network+", aliases: ["Network+", "CompTIA Network"] },
  { name: "CEH", aliases: ["CEH", "Certified Ethical Hacker"] },
  { name: "OSCP", aliases: ["OSCP", "Offensive Security Certified Professional"] },
  { name: "GIAC", aliases: ["GIAC", "GSEC", "GCIH", "GCIA", "GPEN", "GCFA", "GCLD", "GPCS", "GCSA"] },
  { name: "AWS Security Specialty", aliases: ["AWS Certified Security", "AWS Security Specialty", "Security - Specialty", "SCS-C02", "SCS-C03"] },
  { name: "AWS Solutions Architect", aliases: ["AWS Certified Solutions Architect", "AWS Solutions Architect", "SAA-C03"] },
  { name: "AWS Cloud Practitioner", aliases: ["AWS Certified Cloud Practitioner", "Cloud Practitioner"] },
  { name: "AZ-500", aliases: ["AZ-500", "Azure Security Engineer Associate", "Azure Security Engineer"] },
  { name: "SC-200", aliases: ["SC-200", "Security Operations Analyst"] },
  { name: "SC-100", aliases: ["SC-100", "Cybersecurity Architect Expert"] },
  { name: "AZ-104", aliases: ["AZ-104", "Azure Administrator"] },
  { name: "AZ-900", aliases: ["AZ-900", "Azure Fundamentals"] },
  { name: "GCP Professional Cloud Security Engineer", aliases: ["Professional Cloud Security Engineer", "Google Cloud Security Engineer"] },
  { name: "CKS", aliases: ["CKS", "Certified Kubernetes Security Specialist"] },
  { name: "CKA", aliases: ["CKA", "Certified Kubernetes Administrator"] },
  { name: "CCNA", aliases: ["CCNA", "Cisco Certified Network Associate"] },
  { name: "Terraform Associate", aliases: ["Terraform Associate", "HashiCorp Certified"] },
  { name: "SSCP", aliases: ["SSCP", "Systems Security Certified Practitioner"] },
  { name: "CC (ISC2)", aliases: ["ISC2 CC", "Certified in Cybersecurity"] },
];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Short capitalized aliases (IR, AD, Go, Git) must match case-sensitively,
// otherwise words like "ad", "ir" or "go" in normal prose create false positives.
function aliasRegex(alias: string): RegExp {
  const strict = alias.length <= 4 && /^[A-Z]/.test(alias);
  // Word boundaries that also work around symbols like "+", "/" and "&".
  // Spaces match any whitespace, since PDFs often wrap multi-word names across lines.
  const body = escapeRegex(alias).replace(/ /g, "\\s+");
  // "SOC" (security operations) must not match the "SOC 2" compliance report.
  const exclude = alias === "SOC" ? String.raw`(?!\s*(?:1|2|3|II|III)\b)` : "";
  const pattern = `(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])${exclude}`;
  return new RegExp(pattern, strict ? "g" : "gi");
}

type Compiled<T> = { item: T; regexes: RegExp[] };

const compiledSkills: Compiled<Skill>[] = SKILLS.map((item) => ({
  item,
  regexes: [...new Set(item.aliases)].map(aliasRegex),
}));

const compiledCerts: Compiled<Cert>[] = CERTS.map((item) => ({
  item,
  regexes: item.aliases.map(aliasRegex),
}));

function countMatches(text: string, regexes: RegExp[]): number {
  let n = 0;
  for (const re of regexes) {
    re.lastIndex = 0;
    n += text.match(re)?.length ?? 0;
  }
  return n;
}

/** Returns each known skill found in the text with how often it appears. */
export function findSkills(text: string): { skill: Skill; count: number }[] {
  const found: { skill: Skill; count: number }[] = [];
  for (const { item, regexes } of compiledSkills) {
    const count = countMatches(text, regexes);
    if (count > 0) found.push({ skill: item, count });
  }
  return found;
}

export function findCerts(text: string): Cert[] {
  return compiledCerts.filter(({ regexes }) => countMatches(text, regexes) > 0).map((c) => c.item);
}
