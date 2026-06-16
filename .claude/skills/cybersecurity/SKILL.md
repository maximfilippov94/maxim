# Cybersecurity Skills

Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills
754 production-grade cybersecurity skills across 26 domains.
Mapped to: MITRE ATT&CK v19.1, NIST CSF 2.0, MITRE ATLAS, MITRE D3FEND, NIST AI RMF.

## When to use
Use these skills for security analysis, threat hunting, incident response, malware analysis, penetration testing, forensics, cloud security auditing, and compliance tasks.

## Domains

### Digital Forensics
- Disk imaging with dd/dcfldd/Autopsy
- Memory forensics with Volatility/LIME
- Windows artifacts: Registry, Prefetch, MFT, LNK files
- Email forensics (Outlook PST), Browser forensics (Hindsight)

### Malware Analysis
- Android malware (APKtool), Linux ELF, Golang (Ghidra)
- Packed malware (UPX), PDF malware (peepdf/pdfid)
- Sandbox evasion detection, Behavior analysis (Cuckoo)

### Threat Hunting & Intelligence
- Network traffic analysis (Wireshark, Scapy)
- DNS exfiltration detection
- Malicious URL analysis (urlscan)
- Certificate transparency, Threat feeds, MISP integration

### Cloud & Identity Security
- AWS S3 auditing, Azure AD configuration
- GCP IAM, Kubernetes RBAC auditing
- Identity governance

### Detection & Response
- Sigma detection rules (vendor-agnostic)
- Splunk detection rules
- Incident response playbooks
- SIEM implementation (Sentinel)

### Web Application Security
- SQL injection detection/exploitation (sqlmap)
- XSS, CSRF, SSRF analysis
- OWASP Top 10 assessment workflows

### Network Security
- Packet capture and analysis
- Firewall rule auditing
- Intrusion detection (Snort/Suricata)
- VPN and zero-trust assessment

### Vulnerability Management
- CVE triage and prioritization
- CVSS scoring workflows
- Patch management assessment
- Attack surface mapping

### Penetration Testing
- Reconnaissance and OSINT
- Exploitation frameworks (Metasploit)
- Post-exploitation and lateral movement detection
- Red team playbooks

### Container & OT/ICS Security
- Docker/Kubernetes security scanning
- SCADA/ICS protocol analysis
- OT network segmentation review

## Framework Mappings
Every skill maps to:
- **MITRE ATT&CK v19.1** — 286 techniques, 15 tactics
- **NIST CSF 2.0** — Identify, Protect, Detect, Respond, Recover
- **MITRE ATLAS v5.4** — AI/ML adversarial threats
- **MITRE D3FEND v1.3** — Defensive countermeasures
- **NIST AI RMF 1.0** — AI risk management

## Workflow Pattern (all skills)
1. **Assess** — understand scope and prerequisites
2. **Collect** — gather artifacts, logs, or targets
3. **Analyze** — apply the relevant tool or technique
4. **Map** — reference MITRE/NIST framework
5. **Report** — findings with remediation recommendations
6. **Verify** — confirm mitigation or detection effectiveness
