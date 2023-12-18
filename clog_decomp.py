import os
import sys
import argparse

def decrypt(in_file, out_file, key):
    # Check if the input file exists
    try:
        with open(in_file, 'rb') as f_in, open(out_file, 'wb') as f_out:
            index = 0
            while True:
                byte = f_in.read(1)
                if not byte:
                    break

                # XOR the byte with the key and write to output
                decrypted_byte = bytes([byte[0] ^ key[index]])
                f_out.write(decrypted_byte)

                # Increment and wrap the key index if necessary
                index = (index + 1) % len(key)
    except FileNotFoundError:
        print("File not found:", in_file)
        return

# Define the XOR key
xor_key = [
    130, 135, 151, 64, 141, 139, 70, 11, 187, 115, 148, 3, 229, 179, 131, 83,
    105, 107, 131, 218, 149, 175, 74, 35, 135, 229, 151, 172, 36, 88, 175, 54,
    78, 225, 90, 249, 241, 1, 75, 177, 173, 182, 76, 76, 250, 116, 40, 105,
    194, 139, 17, 23, 213, 182, 71, 206, 179, 183, 205, 85, 254, 249, 193, 36,
    255, 174, 144, 46, 73, 108, 78, 9, 146, 129, 78, 103, 188, 107, 156, 222,
    177, 15, 104, 186, 139, 128, 68, 5, 135, 94, 243, 78, 254, 9, 151, 50,
    192, 173, 159, 233, 187, 253, 77, 6, 145, 80, 137, 110, 224, 232, 238, 153,
    83, 0, 60, 166, 184, 34, 65, 50, 177, 189, 245, 40, 80, 224, 114, 174
]

def get_input_output_files():
    # Check if a file path is provided as a command-line argument (drag and drop case)
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        # Use argparse for command line argument
        parser = argparse.ArgumentParser(description='File Decrypter')
        parser.add_argument('--inputfile', hel_p='Path to the file to decrypt', type=str)
        args = parser.parse_args()

        if args.inputfile:
            input_file = args.inputfile
        else:
            # Ask for input file path
            input_file = input("Enter the path to the file to decrypt: ")

    # Determine output file path
    output_dir = input("Enter the folder path to save the decrypted file\nPress enter to use current directory: ")
    if not output_dir:
        output_dir = os.getcwd()

    output_file = os.path.join(output_dir, os.path.basename(input_file) + ".txt")

    return input_file, output_file

input_file, output_file = get_input_output_files()
decrypt(input_file, output_file, xor_key)

print("File decrypted successfully!\nSaved to:", output_file)
input("Press enter to exit...")
print("Exiting...")
