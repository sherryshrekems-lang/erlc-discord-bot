import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from './db.js';

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  new SlashCommandBuilder().setName('help').setDescription('Show available commands'),
  new SlashCommandBuilder().setName('server').setDescription('Show configured ER:LC server status'),
  new SlashCommandBuilder().setName('link').setDescription('Link this Discord server to the web dashboard'),
  new SlashCommandBuilder().setName('settings').setDescription('View or change guild settings').addStringOption(o => o.setName('key').setDescription('Setting key').setRequired(false)).addStringOption(o => o.setName('value').setDescription('Setting value').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('reload').setDescription('Reload guild settings').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

export async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
  console.log(`Deployed ${commands.length} global slash commands`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const settings = getGuildSettings(interaction.guildId);

  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: `🏓 Pong! ${client.ws.ping}ms`, ephemeral: true });
  } else if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder().setTitle('Flix Commands').setColor(settings.accent_color || '#ef4444')
      .setDescription('/ping · /server · /settings · /link · /reload · /help');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (interaction.commandName === 'link') {
    const url = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/dashboard.html?guild=${interaction.guildId}`;
    await interaction.reply({ content: `[Open dashboard](${url})`, ephemeral: true });
  } else if (interaction.commandName === 'reload') {
    getGuildSettings(interaction.guildId);
    await interaction.reply({ content: 'Guild settings reloaded.', ephemeral: true });
  } else if (interaction.commandName === 'settings') {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');
    if (key && value) {
      updateGuildSettings(interaction.guildId, { [key]: value });
      await interaction.reply({ content: `Updated \`${key}\``, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Guild Settings').setColor(settings.accent_color || '#ef4444').addFields(
        { name: 'Prefix', value: settings.prefix || '!', inline: true },
        { name: 'ER:LC Server', value: settings.erlc_server_id || 'Not set', inline: true },
        { name: 'Log Channel', value: settings.log_channel ? `<#${settings.log_channel}>` : 'Not set', inline: true }
      )], ephemeral: true });
    }
  } else if (interaction.commandName === 'server') {
    await interaction.deferReply();
    const id = settings.erlc_server_id;
    if (!id) return interaction.editReply('No ER:LC server ID configured. Use `/settings erlc_server_id <id>` or the dashboard.');
    const base = process.env.ERLC_API_BASE_URL;
    if (!base) return interaction.editReply('ER:LC API base URL is not configured on this installation.');
    try {
      const response = await fetch(`${base}/servers/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('API unavailable');
      const payload = await response.json();
      const server = payload.data || payload;
      const embed = new EmbedBuilder().setTitle(server.name || 'ER:LC Server').setColor(settings.accent_color || '#ef4444')
        .addFields(
          { name: 'Players', value: String(server.players ?? server.CurrentPlayers ?? 'Unknown'), inline: true },
          { name: 'Status', value: String(server.status || 'Online'), inline: true }
        ).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('The ER:LC API could not be reached.');
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is required');
} else {
  client.login(process.env.DISCORD_TOKEN);
}
