#!/usr/bin/env python2.7
'''
This script lists, adds, and deletes users based on the command line
arguments provided. Currently, users can be marked as "admin", which allows
control over the motors on the RazTot.
'''
import sys
sys.path.append("..")

from app import db
from app.models import User

HEADER = '\033[95m'
OKBLUE = '\033[94m'
OKGREEN = '\033[92m'
WARNING = '\033[93m'
FAIL = '\033[91m'
ENDC = '\033[0m'
BOLD = '\033[1m'
UNDERLINE = '\033[4m'

USAGE='''
================================================================
USAGE:
python mod_users.py <option> [argument(s)]

OPTIONS:
    - list: List all users in the database
    - delete <username>: Deletes the user with the
      specified username
    - add <username> <password> [admin]: Adds a user
      with the specified username and password
         + Providing "admin" makes the user an admin, meaning 
         they are allowed control over the RazTot's movement
================================================================
'''

def main(args):
    if len(args) <= 1:
        print(BOLD + FAIL + '\nIncorrect # of arguments' + ENDC)
        print(USAGE)
        sys.exit()

    users = User.query.all()

    if args[1] == 'list':
        list_users(users)
        return
    elif args[1] == 'delete':
        for u in users:
            if len(args) == 3 and args[1] == 'delete' and args[2] == u.username:
                db.session.delete(u)
                print(WARNING + BOLD + '\n--- DELETED "' + u.username + '"' + ENDC)
    elif args[1] == 'add':
        if len(args) == 5 and 'admin' in args[4]:
            u = User(username=args[2], admin=True)
        else:
            u = User(username=args[2])
        u.set_password(args[3])
        db.session.add(u)
        print(WARNING + BOLD + '\n+++ ADDED "' + sys.argv[2] + '"' + ENDC)
    else:
        print(BOLD + FAIL + '\n!!!! Unrecognized argument(s) !!!!' + ENDC)
        print(USAGE)
        sys.exit()

    db.session.commit()

    users = User.query.all()
    list_users(users)

def list_users(users):
    print(OKGREEN + BOLD + '\n-----------------------------------------')
    print('Users: ' + str(len(users)) + ' total')
    for i in range(0, len(users)):
        spaces = '      ' if len(users) < 10 else '       '
        print('  (' + str(i + 1) + ') ID: ' + str(users[i].id) + '\n' + spaces + 'Username: ' + users[i].username + ('\n' + spaces + '(Admin)' if users[i].admin else ''))
    print('-----------------------------------------\n' + ENDC)

if __name__ == '__main__':
    main(sys.argv)

