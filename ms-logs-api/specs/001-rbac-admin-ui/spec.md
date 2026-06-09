# Spec: RBAC Admin UI

## Summary
Add an Administration panel to the ms-logs-api backoffice for managing roles, route permissions, and user assignments.

## Access Control
- Panel only visible to users with 'admin' role (detected from JWT payload in localStorage)

## Features

### Roles Tab
- List all roles
- Create new role (name + description)
- Edit role: modify permissions (select HTTP routes from gateway Swagger)
- Delete role

### Users Tab  
- List users (by role or all)
- Create user (name, email, password)
- View user roles
- Assign role to user
- Remove role from user

## JWT Decoding
Decode JWT from localStorage to extract roles[] without external library (base64 decode of payload section).
