# Project: Slack Reply Tracker Assistant

## Goal

Build a simple Slack bot that helps me keep track of messages that may need my attention or reply.

The bot should monitor messages in my Slack workspace, identify items that likely require action from me, and maintain a list of pending items.

Every morning at 9:00 AM, the bot should send me a Slack DM containing all pending items.

This is a personal learning project.

## Scope

Build for:

* One user
* One Slack workspace

Keep the solution simple and practical.

Do not design for:

* Multiple organizations
* Multi-tenancy
* Billing
* RBAC
* SaaS use cases
* Enterprise scale

## Technology Stack

* Node.js
* TypeScript
* Slack Bolt SDK
* PostgreSQL
* Prisma
* node-cron

Use simple and widely adopted libraries.

## Functional Requirements

### Track Messages

Monitor:

* Public channels
* Private channels
* Direct messages
* Threads

Track messages when:

1. I am mentioned.
2. Someone replies to a thread where I participated.
3. I receive a direct message.
4. The message contains phrases such as:

   * can you
   * could you
   * please check
   * please review
   * need your input
   * what do you think

Store:

* Message text
* Author
* Channel
* Slack message link
* Reason for tracking
* Timestamp

### Status

Each tracked item should have a status:

* PENDING
* DONE
* SNOOZED

### Mark as Done

Mark an item as DONE when:

* I reply in the same thread.
* I react with ✅.

### Snooze

Allow snoozing an item until a future date/time.

Snoozed items should not appear in the daily digest.

## Daily Digest

Every day at 9:00 AM:

1. Fetch all pending items.
2. Exclude snoozed items.
3. Send a Slack DM containing the list.

Example:

Good Morning Amrit,

You have 5 pending items.

1. Backend Team
   Redis migration review request

2. Engineering
   Deployment discussion

3. Direct Message
   Release planning discussion

Include links to the original Slack messages.

## AI Support

Version 1 should use simple rule-based detection only.

Design the code so an AI classifier can be added later if needed.

Do not build AI functionality now.

## Architecture Guidelines

Keep the architecture simple.

Use:

* Route handlers
* Services
* Repositories

Avoid:

* Microservices
* Event buses
* Complex abstractions
* Premature optimization

Prefer readability and simplicity.

## Database

Design only the tables actually needed.

Suggested tables:

* messages
* tracked_items

Avoid creating unnecessary tables.

## Development Process

Before writing code:

1. Review requirements.
2. Identify edge cases.
3. Design database schema.
4. Design application flow.

Then implement the project in small milestones.

Suggested milestones:

### Milestone 1

* Project setup
* Slack app setup
* Database setup
* Receive Slack events

### Milestone 2

* Store messages
* Track pending items

### Milestone 3

* Daily digest

### Milestone 4

* Mark done
* Snooze support

### Milestone 5

* Cleanup
* Error handling
* Deployment

## Important

This is a learning project.

Favor the simplest solution that works.

Avoid overengineering.

If multiple approaches are possible, choose the easiest solution to understand, maintain, and deploy.
