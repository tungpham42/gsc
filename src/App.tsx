import React, { useState, useEffect } from "react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  useGoogleOneTapLogin,
  googleLogout,
} from "@react-oauth/google";
import {
  Button,
  Layout,
  Table,
  Card,
  Typography,
  Spin,
  message,
  Avatar,
  Space,
  Select,
  ConfigProvider,
  Tag,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  GoogleOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltFilled,
  GlobalOutlined,
  ArrowRightOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "./App.css";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

// --- TYPES ---
interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

interface Site {
  siteUrl: string;
  permissionLevel: string;
}

// --- THEME CONFIGURATION ---
const themeConfig = {
  token: {
    fontFamily: "'Work Sans', sans-serif",
    colorPrimary: "#4f46e5",
    colorSuccess: "#10b981",
    borderRadius: 12,
    boxShadowSecondary: "0 4px 12px rgba(0,0,0,0.08)",
  },
};

const Dashboard = () => {
  // --- STATE WITH PERSISTENCE ---

  // 1. Initialize State from LocalStorage if available
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("gsc_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [tokens, setTokens] = useState<any>(() => {
    const saved = localStorage.getItem("gsc_tokens");
    return saved ? JSON.parse(saved) : null;
  });

  const [sites, setSites] = useState<Site[]>(() => {
    const saved = localStorage.getItem("gsc_sites");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedSite, setSelectedSite] = useState<string | null>(() => {
    return localStorage.getItem("gsc_selectedSite");
  });

  const [gscData, setGscData] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // --- PERSISTENCE EFFECTS ---

  // 2. Save to LocalStorage whenever state changes
  useEffect(() => {
    if (user) localStorage.setItem("gsc_user", JSON.stringify(user));
    else localStorage.removeItem("gsc_user");
  }, [user]);

  useEffect(() => {
    if (tokens) localStorage.setItem("gsc_tokens", JSON.stringify(tokens));
    else localStorage.removeItem("gsc_tokens");
  }, [tokens]);

  useEffect(() => {
    if (sites.length > 0)
      localStorage.setItem("gsc_sites", JSON.stringify(sites));
    else localStorage.removeItem("gsc_sites");
  }, [sites]);

  useEffect(() => {
    if (selectedSite) localStorage.setItem("gsc_selectedSite", selectedSite);
    else localStorage.removeItem("gsc_selectedSite");
  }, [selectedSite]);

  // --- LOGIN LOGIC ---

  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      if (credentialResponse.credential) {
        const decoded = jwtDecode<UserProfile>(credentialResponse.credential);
        setUser(decoded);
        message.success({
          content: `Welcome back, ${decoded.name}!`,
          icon: <ThunderboltFilled style={{ color: "#4f46e5" }} />,
        });
      }
    },
    onError: () => console.log("One Tap closed"),
    disabled: !!user, // Don't show if already logged in (even from storage)
  });

  const linkSearchConsole = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      try {
        const res = await axios.post("/.netlify/functions/fetch-gsc-data", {
          code: codeResponse.code,
        });
        setTokens(res.data.tokens);
        setSites(res.data.sites);
        message.success("Search Console Connected");
      } catch (error) {
        console.error(error);
        message.error("Connection failed");
      } finally {
        setLoading(false);
      }
    },
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  });

  const handleSiteSelect = async (siteUrl: string) => {
    setSelectedSite(siteUrl);
    setLoading(true);
    setGscData([]);
    setInsights([]);

    try {
      const res = await axios.post("/.netlify/functions/fetch-gsc-data", {
        tokens: tokens, // Uses the persisted tokens
        siteUrl: siteUrl,
      });
      const rows = res.data.data;
      setGscData(rows || []);
      if (rows && rows.length > 0) analyzeData(rows);
    } catch (error) {
      console.error(error);
      // Optional: If token is expired (401), you might want to auto-logout here
      message.error("Could not fetch data. Token may be expired.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeData = async (data: any[]) => {
    try {
      const res = await axios.post("/.netlify/functions/analyze-groq", {
        gscData: data,
      });
      setInsights(res.data.insights);
    } catch (error) {
      message.warning("AI Analysis busy. Try again.");
    }
  };

  const handleLogout = () => {
    googleLogout();
    // Reset State
    setUser(null);
    setSites([]);
    setGscData([]);
    setInsights([]);
    setTokens(null);
    setSelectedSite(null);

    // Clear Storage explicitly (Redundant due to useEffects, but safer)
    localStorage.removeItem("gsc_user");
    localStorage.removeItem("gsc_tokens");
    localStorage.removeItem("gsc_sites");
    localStorage.removeItem("gsc_selectedSite");
  };

  // --- TABLE COLUMNS ---
  const columns = [
    {
      title: "Query",
      dataIndex: "keys",
      render: (k: any) => (
        <Text strong style={{ color: "#334155" }}>
          {k[0]}
        </Text>
      ),
    },
    {
      title: "Clicks",
      dataIndex: "clicks",
      sorter: (a: any, b: any) => a.clicks - b.clicks,
      render: (val: number) => <Tag color="blue">{val.toLocaleString()}</Tag>,
    },
    {
      title: "Impressions",
      dataIndex: "impressions",
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: "CTR",
      dataIndex: "ctr",
      render: (v: number) => (
        <Text type={v < 0.05 ? "secondary" : "success"} strong>
          {(v * 100).toFixed(2)}%
        </Text>
      ),
    },
    {
      title: "Position",
      dataIndex: "position",
      render: (v: number) => <Text mark>{v.toFixed(1)}</Text>,
    },
  ];

  return (
    <Layout className="hero-background">
      {/* HEADER */}
      <Header
        style={{
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 40px",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              background: "#4f46e5",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SearchOutlined style={{ color: "white", fontSize: 18 }} />
          </div>
          <Text strong style={{ fontSize: 20, letterSpacing: "-0.5px" }}>
            SEO<span style={{ color: "#4f46e5" }}>Analyzer</span>
          </Text>
        </div>

        {user && (
          <Space>
            <Avatar
              src={user.picture}
              style={{
                border: "2px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            />
            <Button
              type="text"
              onClick={handleLogout}
              danger
              style={{ fontWeight: 500 }}
            >
              Sign Out
            </Button>
          </Space>
        )}
      </Header>

      <Content
        style={{
          padding: "60px 20px",
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* VIEW 1: LANDING / LOGIN */}
        {!user && (
          <div style={{ textAlign: "center", marginTop: 80 }}>
            <Title style={{ fontSize: 64, marginBottom: 20, fontWeight: 800 }}>
              Unlock Your Search Traffic.
            </Title>
            <Paragraph
              style={{
                fontSize: 20,
                color: "#64748b",
                maxWidth: 600,
                margin: "0 auto 40px",
              }}
            >
              Connect your Google Search Console to get instant, AI-powered
              insights on your top performing queries and missed opportunities.
            </Paragraph>
            <Space size="middle">
              <Button
                type="primary"
                size="large"
                style={{ height: 56, padding: "0 40px", fontSize: 18 }}
                disabled
              >
                Use One Tap to Sign In
              </Button>
            </Space>
          </div>
        )}

        {/* VIEW 2: LOGGED IN - SETUP */}
        {user && !tokens && (
          <Row justify="center">
            <Col xs={24} md={12}>
              <Card
                className="custom-card"
                style={{ textAlign: "center", padding: 40 }}
              >
                <Avatar
                  size={80}
                  src={user.picture}
                  style={{ marginBottom: 20 }}
                />
                <Title level={3}>Welcome, {user.name}</Title>
                <Paragraph type="secondary" style={{ marginBottom: 30 }}>
                  To start analyzing, we need read-access to your Search Console
                  properties.
                </Paragraph>
                <Button
                  type="primary"
                  size="large"
                  icon={<GoogleOutlined />}
                  onClick={() => linkSearchConsole()}
                  loading={loading}
                  style={{ height: 50, padding: "0 30px" }}
                >
                  Connect Search Console Data
                </Button>
              </Card>
            </Col>
          </Row>
        )}

        {/* VIEW 3: DASHBOARD */}
        {user && tokens && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* Control Bar */}
            <Card className="custom-card" bodyStyle={{ padding: "24px 32px" }}>
              <Row align="middle" justify="space-between" gutter={[16, 16]}>
                <Col>
                  <Space>
                    <GlobalOutlined
                      style={{ fontSize: 24, color: "#4f46e5" }}
                    />
                    <div>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, display: "block" }}
                      >
                        ACTIVE PROPERTY
                      </Text>
                      <Select
                        showSearch
                        style={{ width: 350, fontWeight: 600 }}
                        bordered={false}
                        placeholder="Select a domain to analyze..."
                        optionFilterProp="label"
                        onChange={handleSiteSelect}
                        value={selectedSite}
                        loading={loading}
                        options={sites.map((s) => ({
                          label: s.siteUrl,
                          value: s.siteUrl,
                        }))}
                        suffixIcon={<ArrowRightOutlined />}
                      />
                    </div>
                  </Space>
                </Col>
                {/* Stats Summary (Placeholder logic) */}
                <Col>
                  <Space size="large">
                    {gscData.length > 0 && (
                      <>
                        <Statistic
                          title="Total Clicks"
                          value={gscData.reduce((a, b) => a + b.clicks, 0)}
                          prefix={<RiseOutlined />}
                          valueStyle={{ fontSize: 20, fontWeight: 600 }}
                        />
                        <Statistic
                          title="Queries"
                          value={gscData.length}
                          prefix={<SearchOutlined />}
                          valueStyle={{ fontSize: 20, fontWeight: 600 }}
                        />
                      </>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* If data exists, show tables. If just loaded from storage with no site selected, show nothing/prompt */}
            {gscData.length > 0 && (
              <Row gutter={[24, 24]}>
                {/* AI Insights Sidebar/Top Section */}
                <Col xs={24} lg={insights.length > 0 ? 8 : 24}>
                  <Card
                    className="custom-card ai-card"
                    title={
                      <Space>
                        <RobotOutlined />
                        AI Strategy
                      </Space>
                    }
                    loading={insights.length === 0}
                  >
                    {insights.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                        }}
                      >
                        {insights.map((insight, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(255,255,255,0.1)",
                              padding: 16,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: "white", fontSize: 15 }}>
                              {insight}
                            </Text>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: 20,
                          color: "white",
                        }}
                      >
                        <Spin
                          indicator={
                            <ThunderboltFilled
                              style={{ fontSize: 30, color: "white" }}
                              spin
                            />
                          }
                        />
                        <div style={{ marginTop: 15 }}>
                          Analysing patterns...
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>

                {/* Data Table */}
                <Col xs={24} lg={insights.length > 0 ? 16 : 24}>
                  <Card
                    className="custom-card"
                    title="Top Performing Queries"
                    extra={<Tag color="blue">Last 30 Days</Tag>}
                  >
                    <Table
                      dataSource={gscData}
                      columns={columns}
                      rowKey={(r) => r.keys[0]}
                      pagination={{ pageSize: 6 }}
                    />
                  </Card>
                </Col>
              </Row>
            )}
          </Space>
        )}
      </Content>
    </Layout>
  );
};

export default function App() {
  return (
    <ConfigProvider theme={themeConfig}>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID!}>
        <Dashboard />
      </GoogleOAuthProvider>
    </ConfigProvider>
  );
}
