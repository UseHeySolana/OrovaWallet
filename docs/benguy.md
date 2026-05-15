3.  COMPLETE FEATURE SPECIFICATION

3A.  Onboarding & Authentication

3A.1  Sign Up Flow
1.User enters phone number (primary identifier — no email required for MVP)
2.OTP is sent via SMS (Hubtel or Arkesel for Ghana)
3.User verifies OTP and sets a 6-digit PIN (no passwords — PIN-based auth for simplicity)
4.User selects account type: 'I want to join as a member' or 'I am a supplier'
5.User selects subscription tier and pays via Seesail wallet / Paystack / Payaza
6.User completes a 3-screen onboarding tutorial (swipeable, skippable after first view)
7.User lands on Home Feed

AFRICA DESIGN: Phone number is the identity anchor — not email. This is critical for the Ghanaian market where most users primarily operate via mobile phone and MoMo accounts linked to their phone number.

3A.2  Login Flow
8.Enter phone number
9.Enter 6-digit PIN
10.Biometric unlock (fingerprint / face) after first PIN login — optional, user-enabled
11.Forgotten PIN: OTP reset via SMS

3A.3  Onboarding Tutorial (3 screens)
•Screen 1: 'Welcome to Benguy — Where importers grow together' + Aisha intro video (30s, auto-play, muted)
•Screen 2: Feature tour — Content, Chat, Deals (animated icons)
•Screen 3: 'Complete your KYC to unlock all features' — Ghana Card CTA

3B.  Content Feed (Aisha Engine)

3B.1  Content Types
Type	Description	Upload Limits	Viewer Interactions
Short Video	TikTok-style vertical video	Max 3 min, compressed to 720p	Like, Comment, Share to chat, Save
Long Class	Structured multi-part lesson	Max 45 min, 1080p, chaptered	Like, Comment, Progress tracking, Certificate
Text Post	Rich text with formatting, inline images	2,000 chars	Like, Comment, React
Voice Note	Audio recordings from Aisha	Max 10 min, MP3	Play, Like, Comment
PDF Document	Downloadable guides, templates	Max 20MB, PDF only	Download, Save to vault, Like
Poll	Question with 2–4 options	Closes in 24–72 hrs	Vote, See results after voting
Live Stream	Real-time video (Phase 2)	Phase 2 feature	React, Comment (real-time)

3B.2  Feed Algorithm
•Default: chronological feed (newest first) — most trusted for African users who distrust algorithmic curation
•Pinned posts: Admins can pin up to 3 posts at top of feed
•'For You' tab (Phase 2): AI-ranked based on content interactions, deal history, community membership

3B.3  Offline Reading
•Last 20 feed items cached locally on device
•PDFs and voice notes downloadable for offline access
•Videos show 'Download for offline' button (capped at 5 downloads, reset weekly — to control storage)

3C.  Community Chat System

3C.1  Chat Rooms
Room Type	Who Can Access	Who Can Create	Moderation
General Feed Chat	All active subscribers	Auto-created (system)	Admins + auto-profanity filter
Deal Thread Chat	Only users who purchased that deal	Auto-created when deal goes live	Deal creator + Admins
Sub-Community Chat	Approved sub-community members	KYC-verified users (admin approval)	Sub-community admin + platform admins
1-to-1 DM	Any two subscribers	Either user initiates	Blocked user list; report function
Supplier Inquiry	Subscriber + specific supplier	Subscriber initiates from deal page	Admins can view flagged chats

3C.2  Message Types
•Text (with emoji support)
•Voice note (tap-and-hold to record, max 2 min)
•Image (from camera roll, max 5 images per message)
•Document / PDF attachment
•Deal card share (share a deal link inside chat)
•Content card share (share a feed post inside chat)

3C.3  Chat Features
•Read receipts (single tick sent, double tick delivered, blue double tick read)
•Typing indicator
•Reply-to-message threading
•Message reactions (6 emoji set)
•Message delete (own messages only, within 5 min)
•Report message (sends to admin queue)
•Search within chat room (Phase 2)

UX PRINCIPLE: WhatsApp-familiar UX is intentional. Users in Ghana spend hours per day on WhatsApp. Mirror those patterns to reduce cognitive load and onboarding friction.

3D.  Sub-Communities (Groups)

Sub-communities are private, topic-focused groups within the Benguy platform. Examples: 'Gas Cylinder Importers GH', 'Electronics Traders Kumasi', 'Baby Products Importers'.

3D.1  Creation Flow
12.KYC-verified subscriber submits a sub-community creation request
13.Request includes: name, description, topic category, membership criteria
14.Admin reviews and approves or rejects within 48 hrs
15.On approval: sub-community is created, creator becomes admin
16.Creator can invite members or set to 'Open Join' (anyone can request)
17.Additional admins added by creator must pass KYC + platform admin approval

3D.2  Sub-Community Features
•Dedicated chat room
•Pinned announcements (sub-community admin posts)
•Member directory (visible to members)
•Deal sharing within group (members can share active deals in group chat)
•Group-specific polls
•Admin can remove members

3E.  Deals Engine (Group Container Importation)

CRITICAL: This is the most critical, highest-value, and most complex feature on the platform. It must be built with extreme care around payments, trust, and escrow. Get this right before launch.

3E.1  Deal Lifecycle — Full State Machine
State	Description	Who Triggers	Visible To
DRAFT	Supplier has started creating deal but not submitted	Supplier	Supplier only
PENDING_REVIEW	Supplier submitted deal for admin review	Supplier submits	Supplier + Admins
APPROVED (LIVE)	Admin approved deal; visible to all subscribers	Admin approves	All subscribers
FILLING	Deal is receiving buyer purchases (0–99% full)	Auto on first purchase	All subscribers
FILLED	100% of deal capacity purchased; deal closed	Auto when 100% reached	Participants + Admins
SHIPMENT_STARTED	Supplier confirmed container handover to freight	Admin/Supplier confirms	Participants + Admins
IN_TRANSIT	Container on route (with tracking if available)	Admin updates	Participants + Admins
ARRIVED	Container reached destination (Ghana port/warehouse)	Admin confirms	Participants + Admins
COMPLETED	All parties confirmed; funds released to supplier	Admin triggers	Participants + Admins
CANCELLED	Deal cancelled before filling (admin or supplier)	Admin/Supplier	All subscribers (with reason)
FAILED	Deal expired without reaching 100% fill	Auto (deadline passed)	Participants get refund notice

3E.2  Deal Creation Fields (Supplier Form)
Field	Type	Validation	Notes
Product Name	Text	Max 100 chars	e.g. 'Gas Cylinders 12.5kg'
Product Description	Rich text	Max 1,000 chars	Includes specs, origin
Product Images	Image upload	Min 3, max 10 images	Compressed to 800px on upload
Container Size	Select	20ft or 40ft only	Drives capacity calculation
Total Units Available	Number	Must be > 0	e.g. 50 cylinders for 20ft
Min Units Per Buyer	Number	Min 1	Prevents micro-splitting
Supplier Price Per Unit (USD)	Number	Must match container math	Seesail converts to GHS
Shipping Cost (Total, GHS)	Number	Entered after Aisha consultation	Added to total deal cost
Seesail Platform Fee (%)	Auto-calculated	Set by admin in system config	Applied on top; shown to buyer
Deal Deadline	Date picker	Must be min 14 days from today	Deals can't run forever
Supplier Profile	Auto-attached	Requires verified supplier account	Shows supplier rating
Customs & Compliance Notes	Text	Optional	HS codes, restrictions etc.

3E.3  Deal Display Card (What Buyers See)
•Product name + hero image
•Supplier name + verified badge + rating (stars)
•All-in price per unit in GHS (product + shipping + Seesail fee — no surprises)
•Container fill progress bar (e.g. '68% filled — 16 units left')
•Countdown timer to deal deadline
•Number of buyers who have joined
•'Join Deal' CTA button (disabled if user not KYC-verified)
•Deal chat button (locked icon if user hasn't bought in)

3E.4  Deal Purchase Flow
18.User taps 'Join Deal'
19.User selects number of units (within min/max constraints)
20.Platform shows order summary: units × price + breakdown
21.User taps 'Pay with Seesail Wallet'
22.If wallet balance insufficient → redirect to 'Top Up Wallet' flow
23.On sufficient balance → deduct from wallet → funds go to escrow
24.User receives in-app + SMS confirmation
25.User appears in deal's buyer list
26.Deal chat thread unlocked for this user
27.If deal reaches 100% → auto-trigger FILLED state → all participants notified

3E.5  Escrow & Payment Release Rules
Milestone	% Released to Supplier	Trigger	Verified By
Deal Filled (100%)	0% — funds held in escrow	Auto	System
Container Handed to Freight Forwarder	30%	Supplier uploads Bill of Lading	Admin
Container Departed Origin Port	20%	Supplier uploads vessel tracking	Admin
Container Arrived Ghana Port	30%	Admin confirms at port	Admin
All Buyers Confirmed Receipt	20%	Majority buyer confirmation (>70%)	System + Admin

CRITICAL: Funds NEVER go directly to the supplier outside of the milestone schedule. Seesail holds all escrow. This is the #1 trust mechanism on the platform. Do not compromise this.

3E.6  Failed Deal Refund Flow
28.Deal expires without reaching 100% fill
29.System auto-transitions deal to FAILED state
30.All escrowed funds returned to buyers' Seesail wallets within 24 hours
31.Buyers receive push + SMS notification of refund
32.Partial fill refunds: if supplier agrees to proceed at partial fill → admin can manually override to APPROVED with reduced container

3E.7  African-Context Deal Features
•'Susu-style deal' badge — deals structured like traditional Ghanaian cooperative savings (community completes together)
•Deal sharing via WhatsApp — generate a WhatsApp-shareable link card for deals (pre-filled message with deal name, price, fill %)
•Unit-in-footage display — show 20ft/40ft container visually with each buyer's portion shaded (very intuitive for Ghanaian traders who understand container sizes)
•'Trending in Ghana' tag — deals with fastest fill rate get a trending badge