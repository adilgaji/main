"""Самоподписанный сертификат для https в локальной сети (нужен, чтобы телефон разрешил микрофон). Пересоздаётся, если сменился IP.
Телефон покажет предупреждение о сертификате — это нормально: «Дополнительно → Всё равно перейти»."""
import socket, ipaddress, datetime, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
CERT, KEY = ROOT / 'cert' / 'server.crt', ROOT / 'cert' / 'server.key'
def local_ips():
    ips = {'127.0.0.1'}
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('10.255.255.255', 1)); ips.add(s.getsockname()[0]); s.close()
    except Exception: pass
    try: ips |= {i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)}
    except Exception: pass
    return sorted(ips)
def main():
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    ips = local_ips()
    if CERT.exists() and KEY.exists():
        try:
            c = x509.load_pem_x509_certificate(CERT.read_bytes()); san = c.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.IPAddress)
            if {ipaddress.ip_address(i) for i in ips} <= set(san) and c.not_valid_after_utc > datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30):
                print('Сертификат актуален'); return
        except Exception: pass
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048); name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'HSK4 local')])
    now = datetime.datetime.now(datetime.timezone.utc)
    san = x509.SubjectAlternativeName([x509.DNSName('localhost')] + [x509.IPAddress(ipaddress.ip_address(i)) for i in ips])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1)).not_valid_after(now + datetime.timedelta(days=800)).add_extension(san, False)
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), True).sign(key, hashes.SHA256()))
    CERT.parent.mkdir(exist_ok=True); CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    KEY.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
    print('Сертификат создан для:', ', '.join(ips))
if __name__ == '__main__':
    try: main()
    except Exception as e: print('Не удалось создать сертификат (https для телефона не будет):', e); sys.exit(0)
