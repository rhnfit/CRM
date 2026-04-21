import {
  Department,
  LeadSource,
  LeadStatus,
  PrismaClient,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'director@rhn.local';
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const director = await prisma.user.upsert({
    where: { email },
    create: {
      name: 'System Owner',
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
      department: Department.SALES,
    },
    update: {
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  const team = await prisma.team.upsert({
    where: { id: 'seed-team-sales-1' },
    create: {
      id: 'seed-team-sales-1',
      name: 'Inside Sales — Alpha',
      department: Department.SALES,
      managerId: director.id,
    },
    update: { managerId: director.id },
  });

  const agentHash = await bcrypt.hash('AgentPass123!', 10);
  const agentEmail = 'agent@rhn.local';
  const agent = await prisma.user.upsert({
    where: { email: agentEmail },
    create: {
      name: 'Sales Agent',
      email: agentEmail,
      passwordHash: agentHash,
      role: Role.AGENT,
      department: Department.SALES,
      teamId: team.id,
      managerId: director.id,
    },
    update: { teamId: team.id, managerId: director.id },
  });

  const PIPELINE_ID = 'seed-pipeline-sales-default';
  await prisma.pipeline.upsert({
    where: { id: PIPELINE_ID },
    create: {
      id: PIPELINE_ID,
      name: 'Sales — Default',
      isDefault: true,
      sortOrder: 0,
    },
    update: { isDefault: true, name: 'Sales — Default' },
  });

  const stageDefs: { id: string; name: string; sortOrder: number; mapsToStatus: LeadStatus }[] = [
    { id: 'seed-stage-NEW', name: 'New', sortOrder: 0, mapsToStatus: LeadStatus.NEW },
    { id: 'seed-stage-CONTACTED', name: 'Contacted', sortOrder: 1, mapsToStatus: LeadStatus.CONTACTED },
    { id: 'seed-stage-FOLLOW_UP', name: 'Follow up', sortOrder: 2, mapsToStatus: LeadStatus.FOLLOW_UP },
    { id: 'seed-stage-QUALIFIED', name: 'Qualified', sortOrder: 3, mapsToStatus: LeadStatus.QUALIFIED },
    { id: 'seed-stage-TRIAL', name: 'Trial', sortOrder: 4, mapsToStatus: LeadStatus.TRIAL },
    { id: 'seed-stage-WON', name: 'Won', sortOrder: 5, mapsToStatus: LeadStatus.WON },
    { id: 'seed-stage-CONVERTED', name: 'Converted', sortOrder: 6, mapsToStatus: LeadStatus.CONVERTED },
    { id: 'seed-stage-COLD', name: 'Cold', sortOrder: 7, mapsToStatus: LeadStatus.COLD },
    { id: 'seed-stage-LOST', name: 'Lost', sortOrder: 8, mapsToStatus: LeadStatus.LOST },
  ];
  for (const s of stageDefs) {
    await prisma.pipelineStage.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        pipelineId: PIPELINE_ID,
        name: s.name,
        sortOrder: s.sortOrder,
        mapsToStatus: s.mapsToStatus,
      },
      update: {
        name: s.name,
        sortOrder: s.sortOrder,
        mapsToStatus: s.mapsToStatus,
        pipelineId: PIPELINE_ID,
      },
    });
  }

  const supportEmail = 'support@rhn.local';
  const supportHash = await bcrypt.hash('SupportPass123!', 10);
  const support = await prisma.user.upsert({
    where: { email: supportEmail },
    create: {
      name: 'Support Agent',
      email: supportEmail,
      passwordHash: supportHash,
      role: Role.AGENT,
      department: Department.SUPPORT,
      managerId: director.id,
    },
    update: {},
  });

  const demoLeadPhones = ['919800000001', '919800000002'];
  const demoLeads = await prisma.lead.findMany({
    where: { phone: { in: demoLeadPhones } },
    select: { id: true },
  });
  if (demoLeads.length) {
    await prisma.sale.deleteMany({ where: { leadId: { in: demoLeads.map((l) => l.id) } } });
  }
  await prisma.lead.deleteMany({
    where: { phone: { in: demoLeadPhones } },
  });
  await prisma.lead.createMany({
    data: [
      {
        name: 'Demo Lead — Website',
        phone: '919800000001',
        source: LeadSource.WEBSITE,
        status: LeadStatus.NEW,
        assignedTo: agent.id,
        campaign: 'Jan protein',
        productInterest: 'Whey',
        leadScore: 72,
        pipelineId: PIPELINE_ID,
        stageId: 'seed-stage-NEW',
      },
      {
        name: 'Demo Lead — WhatsApp',
        phone: '919800000002',
        source: LeadSource.WHATSAPP,
        status: LeadStatus.FOLLOW_UP,
        assignedTo: agent.id,
        leadScore: 55,
        pipelineId: PIPELINE_ID,
        stageId: 'seed-stage-FOLLOW_UP',
      },
    ],
  });

  await prisma.ticket.deleteMany({
    where: { phone: { in: ['919811111111', '919822222222'] } },
  });
  await prisma.ticket.createMany({
    data: [
      {
        customerName: 'Demo Customer A',
        phone: '919811111111',
        type: TicketType.QUERY,
        priority: TicketPriority.NORMAL,
        status: TicketStatus.OPEN,
        assignedTo: support.id,
      },
      {
        customerName: 'Demo Customer B',
        phone: '919822222222',
        type: TicketType.ISSUE,
        priority: TicketPriority.HIGH,
        status: TicketStatus.IN_PROGRESS,
        assignedTo: support.id,
      },
    ],
  });

  const lead = await prisma.lead.findFirst({ where: { phone: '919800000001' } });
  if (lead) {
    await prisma.sale.deleteMany({ where: { leadId: lead.id } });
    await prisma.sale.create({
      data: {
        leadId: lead.id,
        userId: agent.id,
        amount: 12999,
        product: 'Starter kit',
        paymentStatus: 'paid',
        orderSource: 'website',
      },
    });
  }

  const stagesForBackfill = await prisma.pipelineStage.findMany({
    where: { pipelineId: PIPELINE_ID },
  });
  const statusToStage = new Map(
    stagesForBackfill.filter((s) => s.mapsToStatus).map((s) => [s.mapsToStatus!, s.id]),
  );
  const orphans = await prisma.lead.findMany({ where: { stageId: null, isDeleted: false } });
  for (const l of orphans) {
    const sid = statusToStage.get(l.status);
    if (sid) {
      await prisma.lead.update({
        where: { id: l.id },
        data: { stageId: sid, pipelineId: PIPELINE_ID },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`  Owner: ${email} / ${password}`);
  console.log(`  Agent:    ${agentEmail} / AgentPass123!`);
  console.log(`  Support:  ${supportEmail} / SupportPass123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
