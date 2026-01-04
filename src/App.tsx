import React, { useState } from "react";
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
} from "antd";
import {
  GoogleOutlined,
  RobotOutlined,
  SearchOutlined,
  LogoutOutlined,
  ThunderboltFilled,
  GlobalOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

interface Site {
  siteUrl: string;
  permissionLevel: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  // New States for Site Selection
  const [tokens, setTokens] = useState<any>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const [gscData, setGscData] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. ONE TAP LOGIN
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      if (credentialResponse.credential) {
        const decoded = jwtDecode<UserProfile>(credentialResponse.credential);
        setUser(decoded);
        message.success(`Welcome back, ${decoded.name}!`);
      }
    },
    onError: () => {
      console.log("One Tap closed or failed");
    },
    disabled: !!user,
  });

  // 2. AUTHORIZATION & LIST SITES
  const linkSearchConsole = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      try {
        // Step A: Send Code to Backend -> Get Tokens & Site List
        const res = await axios.post("/.netlify/functions/fetch-gsc-data", {
          code: codeResponse.code,
        });

        setTokens(res.data.tokens); // Save tokens for next step
        setSites(res.data.sites); // Save sites to display
        message.success("Connected! Please select a website.");
      } catch (error) {
        console.error(error);
        message.error("Failed to connect Search Console");
      } finally {
        setLoading(false);
      }
    },
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  });

  // 3. FETCH DATA (After Site Selection)
  const handleSiteSelect = async (siteUrl: string) => {
    setSelectedSite(siteUrl);
    setLoading(true);
    setGscData([]);
    setInsights([]);

    try {
      // Step B: Send Tokens + Selected Site -> Get Data
      const res = await axios.post("/.netlify/functions/fetch-gsc-data", {
        tokens: tokens,
        siteUrl: siteUrl,
      });

      const rows = res.data.data;
      setGscData(rows);

      // Trigger AI Analysis automatically
      if (rows && rows.length > 0) {
        analyzeData(rows);
      } else {
        message.info(
          "No traffic data found for this site in the last 30 days."
        );
      }
    } catch (error) {
      message.error("Failed to fetch site data");
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
      message.warning("AI Analysis could not complete");
    }
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setSites([]);
    setGscData([]);
    setInsights([]);
    setTokens(null);
    setSelectedSite(null);
  };

  const columns = [
    { title: "Query", dataIndex: "keys", render: (k: any) => k[0] },
    {
      title: "Clicks",
      dataIndex: "clicks",
      sorter: (a: any, b: any) => a.clicks - b.clicks,
    },
    { title: "Impressions", dataIndex: "impressions" },
    {
      title: "CTR",
      dataIndex: "ctr",
      render: (v: number) => (
        <Text type={v < 0.05 ? "danger" : "success"}>
          {(v * 100).toFixed(2)}%
        </Text>
      ),
    },
    {
      title: "Position",
      dataIndex: "position",
      render: (v: number) => v.toFixed(1),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      <Header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#001529",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <SearchOutlined
            style={{ marginRight: 8, fontSize: 20, color: "white" }}
          />
          <Title level={4} style={{ color: "white", margin: 0 }}>
            SEO Analyzer
          </Title>
        </div>
        {user && (
          <Space>
            <Avatar src={user.picture} />
            <Text style={{ color: "white" }}>{user.name}</Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ color: "#ff4d4f" }}
            />
          </Space>
        )}
      </Header>

      <Content
        style={{
          padding: "40px",
          maxWidth: 1200,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* State 1: Not Logged In */}
        {!user && (
          <Card style={{ textAlign: "center", padding: 60 }}>
            <Title level={2}>Analyze your Google Search Performance</Title>
            <Paragraph type="secondary">
              Sign in with Google to start.
            </Paragraph>
            <Spin tip="Waiting for One Tap..." />
          </Card>
        )}

        {/* State 2: Logged In, No Access Token Yet */}
        {user && !tokens && (
          <Card style={{ textAlign: "center", padding: 60 }}>
            <Title level={3}>Welcome, {user.name}</Title>
            <Paragraph>
              We need permission to list your websites from Search Console.
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<GoogleOutlined />}
              onClick={() => linkSearchConsole()}
              loading={loading}
            >
              Connect Search Console
            </Button>
          </Card>
        )}

        {/* State 3: Token Received, Select Site */}
        {user && tokens && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* Site Selector Card */}
            <Card>
              <Space
                size="large"
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <Space>
                  <GlobalOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                  <Text strong style={{ fontSize: 16 }}>
                    Select Website:
                  </Text>
                  <Select
                    style={{ width: 300 }}
                    placeholder="Choose a property..."
                    onChange={handleSiteSelect}
                    value={selectedSite}
                    loading={loading}
                    options={sites.map((site) => ({
                      label: site.siteUrl,
                      value: site.siteUrl,
                    }))}
                  />
                </Space>
                {loading && <Spin />}
              </Space>
            </Card>

            {/* Dashboard Data */}
            {gscData.length > 0 && (
              <>
                <Card
                  title={
                    <Space>
                      <RobotOutlined style={{ color: "#1890ff" }} />
                      AI Insights
                    </Space>
                  }
                  style={{ borderTop: "4px solid #1890ff" }}
                >
                  {insights.length > 0 ? (
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      {insights.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: 8, fontSize: 16 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ textAlign: "center", padding: 20 }}>
                      <Spin
                        indicator={
                          <ThunderboltFilled style={{ fontSize: 24 }} spin />
                        }
                      />
                      <div style={{ marginTop: 10 }}>
                        Analyzing SEO Strategy...
                      </div>
                    </div>
                  )}
                </Card>

                <Card
                  title="Top Performing Queries"
                  extra={<Text type="secondary">Last 30 Days</Text>}
                >
                  <Table
                    dataSource={gscData}
                    columns={columns}
                    rowKey={(r) => r.keys[0]}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>
              </>
            )}
          </Space>
        )}
      </Content>
    </Layout>
  );
};

export default function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID!}>
      <Dashboard />
    </GoogleOAuthProvider>
  );
}
