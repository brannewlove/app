
import bcrypt
import sys

def generate_hash(password):
    """Generates a bcrypt hash for the given password."""
    if not password:
        print("Please provide a password.")
        return
    
    password_bytes = password.encode('utf-8')
    hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    print("Generated bcrypt hash:")
    print(hashed_password.decode('utf-8'))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        generate_hash(sys.argv[1])
    else:
        password = input("Enter the password to hash: ")
        generate_hash(password)